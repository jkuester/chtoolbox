import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Either, Layer, Stream } from 'effect';
import sinon from 'sinon';
import { PouchDBService } from '../../src/services/pouchdb.js';
import { expect } from 'chai';
import * as UpgradeSvc from '../../src/services/upgrade.js';
import { genWithLayer, sandbox } from '../utils/base.js';
import { ChtClientService } from '../../src/services/cht-client.js';
import esmock from 'esmock';

const version = '3.7.0';
const EXPECTED_ALL_DOCS_OPTS = {
  endkey: 'upgrade_log:0:',
  descending: true,
  limit: 1,
  include_docs: true
} as const;
const COMPLETED_STATES = ['finalized', 'aborted', 'errored', 'interrupted'];
const IN_PROGRESS_STATES = ['initiated', 'staged', 'indexing', 'completing', 'finalizing', 'indexed'];

const createUpgradeLog = ({ idMillis = 0, state = '', state_history = [] } = {}) => ({
  _id: `upgrade_log:${idMillis.toString()}:`,
  state: state,
  state_history: state_history
});

const pouchGet = sandbox.stub();
const dbAllDocs = sandbox.stub();
const mockPouchSvc = { streamChanges: sandbox.stub() };
const mockUpgradeLib = {
  upgradeCht: sandbox.stub(),
  stageChtUpgrade: sandbox.stub(),
  completeChtUpgrade: sandbox.stub(),
}

const { UpgradeService } = await esmock<typeof UpgradeSvc>('../../src/services/upgrade.js', {
  '../../src/services/pouchdb.js': mockPouchSvc,
  '../../src/libs/cht/upgrade.js': mockUpgradeLib,
});
const run = UpgradeService.Default.pipe(
  Layer.provide(Layer.succeed(PouchDBService, {
    get: pouchGet,
  } as unknown as PouchDBService),),
  Layer.provide(Layer.succeed(ChtClientService, { } as unknown as ChtClientService)),
  genWithLayer,
);

describe('Upgrade Service', () => {
  beforeEach(() => pouchGet.returns(Effect.succeed({ allDocs: dbAllDocs, })));

  describe('upgrade', () => {
    COMPLETED_STATES.forEach(state => {
      it(`triggers upgrade when existing upgrade log completed with state ${state}`, run(function* () {
        const upgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
        mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

        yield* UpgradeService.upgrade(version);

        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(dbAllDocs.args[1][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(mockUpgradeLib.upgradeCht.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [upgradeLog._id],
        })).to.be.true;
      }));
    });

    IN_PROGRESS_STATES.forEach(state => {
      it(`returns error when there is already an existing upgrade with status ${state}`, run(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.upgrade(version));

        if (Either.isLeft(either)) {
          expect(either.left.message).to.equal('Upgrade already in progress.');
          expect(pouchGet.args).to.deep.equal([['medic-logs']]);
          expect(dbAllDocs.calledOnce).to.be.true;
          expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
          expect(mockUpgradeLib.upgradeCht.calledOnceWithExactly(version)).to.be.true;
          expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
          expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
          expect(mockPouchSvc.streamChanges.notCalled).to.be.true;
        } else {
          expect.fail('Expected error to be thrown');
        }
      }));
    });

    it('streams updates to upgrade log when upgrade is triggered', run(function* () {
      dbAllDocs.onFirstCall().resolves({ rows: [] });
      const initUpgradeLog = createUpgradeLog({ idMillis: 1, state: 'initiated' });
      dbAllDocs.onSecondCall().resolves({ rows: [{ doc: initUpgradeLog }] });
      const expectedUpgradeLogs = [
        initUpgradeLog,
        { ...initUpgradeLog, state: 'staged' },
        { ...initUpgradeLog, state: 'indexing' },
        { ...initUpgradeLog, state: 'indexed' },
        { ...initUpgradeLog, state: 'completing' },
        { ...initUpgradeLog, state: 'finalizing' },
        { ...initUpgradeLog, state: 'complete' },
        { ...initUpgradeLog, state: 'aborting' },
        { ...initUpgradeLog, state: 'finalized' },
      ];
      const changesStream = Stream
        .fromIterable(expectedUpgradeLogs)
        .pipe(Stream.map(log => ({ doc: log })));
      mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

      const stream = yield* UpgradeService.upgrade(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [initUpgradeLog._id],
      })).to.be.true;
      expect(dbAllDocs.calledTwice).to.be.true;
      expect(dbAllDocs.args[0][0]).to.deep.include({
        endkey: 'upgrade_log:0:',
        descending: true,
        limit: 1,
        include_docs: true
      });
      expect(dbAllDocs.args[1][0]).to.deep.include({
        endkey: 'upgrade_log:0:',
        descending: true,
        limit: 1,
        include_docs: true
      });
      expect(mockUpgradeLib.upgradeCht.calledOnceWithExactly(version)).to.be.true;
      expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
      expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
    }));

    COMPLETED_STATES.forEach(state => {
      it('stops streaming values when upgrade log has status ', run(function* () {
        dbAllDocs.onFirstCall().resolves({ rows: [] });
        const initUpgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.onSecondCall().resolves({ rows: [{ doc: initUpgradeLog }] });
        const expectedUpgradeLogs = [
          initUpgradeLog,
          { ...initUpgradeLog, state: 'completing' },
        ];
        const changesStream = Stream
          .fromIterable(expectedUpgradeLogs)
          .pipe(Stream.map(log => ({ doc: log })));
        mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

        const stream = yield* UpgradeService.upgrade(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([initUpgradeLog]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [initUpgradeLog._id],
        })).to.be.true;
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(dbAllDocs.args[1][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(mockUpgradeLib.upgradeCht.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
      }));
    });

    it('throws error if an upgrade log cannot be found when upgrade is triggered', run(function* () {
      dbAllDocs.resolves({ rows: [] });

      const either = yield* UpgradeService
        .upgrade(version)
        .pipe(
          Effect.catchAllDefect(Effect.fail),
          Effect.either
        );

      if (Either.isLeft(either)) {
        expect(either.left).to.be.instanceOf(Error);
        expect((either.left as Error).message).to.equal('No upgrade log found');
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(dbAllDocs.args[1][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(mockUpgradeLib.upgradeCht.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
        expect(mockPouchSvc.streamChanges.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be thrown');
      }
    }));
  });

  describe('stage', () => {
    COMPLETED_STATES.forEach(state => {
      it(`stages upgrade when existing upgrade log completed with state ${state}`, run(function* () {
        const upgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
        mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

        yield* UpgradeService.stage(version);

        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(dbAllDocs.args[1][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [upgradeLog._id],
        })).to.be.true;
      }));
    });

    IN_PROGRESS_STATES.forEach(state => {
      it(`returns error when there is already an existing upgrade with status ${state}`, run(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.stage(version));

        if (Either.isLeft(either)) {
          expect(either.left.message).to.equal('Upgrade already in progress.');
          expect(pouchGet.args).to.deep.equal([['medic-logs']]);
          expect(dbAllDocs.calledOnce).to.be.true;
          expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
          expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
          expect(mockUpgradeLib.stageChtUpgrade.calledOnceWithExactly(version)).to.be.true;
          expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
          expect(mockPouchSvc.streamChanges.notCalled).to.be.true;
        } else {
          expect.fail('Expected error to be thrown');
        }
      }));
    });

    it('streams updates to upgrade log when upgrade is staged', run(function* () {
      dbAllDocs.onFirstCall().resolves({ rows: [] });
      const initUpgradeLog = createUpgradeLog({ idMillis: 1, state: 'initiated' });
      dbAllDocs.onSecondCall().resolves({ rows: [{ doc: initUpgradeLog }] });
      const expectedUpgradeLogs = [
        initUpgradeLog,
        { ...initUpgradeLog, state: 'staged' },
        { ...initUpgradeLog, state: 'indexing' },
        { ...initUpgradeLog, state: 'completing' },
        { ...initUpgradeLog, state: 'finalizing' },
        { ...initUpgradeLog, state: 'complete' },
        { ...initUpgradeLog, state: 'aborting' },
        { ...initUpgradeLog, state: 'indexed' },
      ];
      const changesStream = Stream
        .fromIterable(expectedUpgradeLogs)
        .pipe(Stream.map(log => ({ doc: log })));
      mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

      const stream = yield* UpgradeService.stage(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [initUpgradeLog._id],
      })).to.be.true;
      expect(dbAllDocs.calledTwice).to.be.true;
      expect(dbAllDocs.args[0][0]).to.deep.include({
        endkey: 'upgrade_log:0:',
        descending: true,
        limit: 1,
        include_docs: true
      });
      expect(dbAllDocs.args[1][0]).to.deep.include({
        endkey: 'upgrade_log:0:',
        descending: true,
        limit: 1,
        include_docs: true
      });
      expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
      expect(mockUpgradeLib.stageChtUpgrade.calledOnceWithExactly(version)).to.be.true;
      expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
    }));

    ['indexed', ...COMPLETED_STATES].forEach(state => {
      it('stops streaming values when upgrade log has status ', run(function* () {
        dbAllDocs.onFirstCall().resolves({ rows: [] });
        const initUpgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.onSecondCall().resolves({ rows: [{ doc: initUpgradeLog }] });
        const expectedUpgradeLogs = [
          initUpgradeLog,
          { ...initUpgradeLog, state: 'completing' },
        ];
        const changesStream = Stream
          .fromIterable(expectedUpgradeLogs)
          .pipe(Stream.map(log => ({ doc: log })));
        mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

        const stream = yield* UpgradeService.stage(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([initUpgradeLog]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [initUpgradeLog._id],
        })).to.be.true;
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(dbAllDocs.args[1][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
      }));
    });
  });

  describe('complete', () => {
    it('completes upgrade when existing upgrade log has state indexed', run(function* () {
      const upgradeLog = createUpgradeLog({ idMillis: 1, state: 'indexed' });
      dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
      mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

      yield* UpgradeService.complete(version);

      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(dbAllDocs.calledTwice).to.be.true;
      expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
      expect(dbAllDocs.args[1][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
      expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
      expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
      expect(mockUpgradeLib.completeChtUpgrade.calledOnceWithExactly(version)).to.be.true;
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [upgradeLog._id],
      })).to.be.true;
    }));

    [...COMPLETED_STATES, ...IN_PROGRESS_STATES].slice(0, -1).forEach(state => {
      it('returns error when there is no existing upgrade with status indexed', run(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.complete(version));

        if (Either.isLeft(either)) {
          expect(either.left.message).to.equal('No upgrade ready for completion.');
          expect(pouchGet.args).to.deep.equal([['medic-logs']]);
          expect(dbAllDocs.calledOnce).to.be.true;
          expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
          expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
          expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
          expect(mockUpgradeLib.completeChtUpgrade.calledOnceWithExactly(version)).to.be.true;
          expect(mockPouchSvc.streamChanges.notCalled).to.be.true;
        } else {
          expect.fail('Expected error to be thrown');
        }
      }));
    });

    it('streams updates to upgrade log when complete is triggered', run(function* () {
      const initUpgradeLog = createUpgradeLog({ idMillis: 1, state: 'indexed' });
      dbAllDocs.resolves({ rows: [{ doc: initUpgradeLog }] });
      const expectedUpgradeLogs = [
        initUpgradeLog,
        { ...initUpgradeLog, state: 'staged' },
        { ...initUpgradeLog, state: 'indexing' },
        { ...initUpgradeLog, state: 'indexed' },
        { ...initUpgradeLog, state: 'completing' },
        { ...initUpgradeLog, state: 'finalizing' },
        { ...initUpgradeLog, state: 'complete' },
        { ...initUpgradeLog, state: 'aborting' },
        { ...initUpgradeLog, state: 'finalized' },
      ];
      const changesStream = Stream
        .fromIterable(expectedUpgradeLogs)
        .pipe(Stream.map(log => ({ doc: log })));
      mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

      const stream = yield* UpgradeService.complete(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [initUpgradeLog._id],
      })).to.be.true;
      expect(dbAllDocs.calledTwice).to.be.true;
      expect(dbAllDocs.args[0][0]).to.deep.include({
        endkey: 'upgrade_log:0:',
        descending: true,
        limit: 1,
        include_docs: true
      });
      expect(dbAllDocs.args[1][0]).to.deep.include({
        endkey: 'upgrade_log:0:',
        descending: true,
        limit: 1,
        include_docs: true
      });
      expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
      expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
      expect(mockUpgradeLib.completeChtUpgrade.calledOnceWithExactly(version)).to.be.true;
    }));

    COMPLETED_STATES.forEach(state => {
      it('stops streaming values when upgrade log has status ', run(function* () {
        const initUpgradeLog = createUpgradeLog({ idMillis: 1, state: 'indexed' });
        dbAllDocs.resolves({ rows: [{ doc: initUpgradeLog }] });
        const expectedUpgradeLogs = [
          { ...initUpgradeLog, state },
          { ...initUpgradeLog, state: 'completing' },
        ];
        const changesStream = Stream
          .fromIterable(expectedUpgradeLogs)
          .pipe(Stream.map(log => ({ doc: log })));
        mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

        const stream = yield* UpgradeService.complete(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([{ ...initUpgradeLog, state }]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [initUpgradeLog._id],
        })).to.be.true;
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(dbAllDocs.args[1][0]).to.deep.include({
          endkey: 'upgrade_log:0:',
          descending: true,
          limit: 1,
          include_docs: true
        });
        expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.calledOnceWithExactly(version)).to.be.true;
      }));
    });
  });
});
