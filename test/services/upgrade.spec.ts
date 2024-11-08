import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Either, Layer, Stream, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as pouchDbService from '../../src/services/pouchdb';
import { PouchDBService } from '../../src/services/pouchdb';
import { expect } from 'chai';
import { UpgradeService } from '../../src/services/upgrade';
import { ChtUpgradeService } from '../../src/services/cht/upgrade';

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

describe('Upgrade Service', () => {
  let chtUpgrade: SinonStub;
  let chtStage: SinonStub;
  let chtComplete: SinonStub;
  let pouchGet: SinonStub;
  let dbAllDocs: SinonStub;
  let streamChanges: SinonStub;

  beforeEach(() => {
    chtUpgrade = sinon.stub();
    chtStage = sinon.stub();
    chtComplete = sinon.stub();
    pouchGet = sinon.stub();
    dbAllDocs = sinon.stub();
    streamChanges = sinon.stub(pouchDbService, 'streamChanges');
    pouchGet.returns(Effect.succeed({ allDocs: dbAllDocs, }));
  });

  afterEach(() => sinon.restore());

  const run = (test: Effect.Effect<unknown, unknown, UpgradeService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(UpgradeService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(PouchDBService, {
        get: pouchGet,
      } as unknown as PouchDBService),),
      Effect.provide(Layer.succeed(ChtUpgradeService, {
        upgrade: chtUpgrade,
        stage: chtStage,
        complete: chtComplete,
      } as unknown as ChtUpgradeService)),
    ));
  };

  describe('upgrade', () => {
    COMPLETED_STATES.forEach(state => {
      it(`triggers upgrade when existing upgrade log completed with state ${state}`, run(Effect.gen(function* () {
        const upgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
        streamChanges.returns(sinon.stub().returns(Stream.empty));

        yield* UpgradeService.upgrade(version);

        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(dbAllDocs.args[1][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(chtUpgrade.calledOnceWithExactly(version)).to.be.true;
        expect(chtStage.notCalled).to.be.true;
        expect(chtComplete.notCalled).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [upgradeLog._id],
        })).to.be.true;
      })));
    });

    IN_PROGRESS_STATES.forEach(state => {
      it(`returns error when there is already an existing upgrade with status ${state}`, run(Effect.gen(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.upgrade(version));

        if (Either.isLeft(either)) {
          expect(either.left.message).to.equal('Upgrade already in progress.');
          expect(pouchGet.args).to.deep.equal([['medic-logs']]);
          expect(dbAllDocs.calledOnce).to.be.true;
          expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
          expect(chtUpgrade.notCalled).to.be.true;
          expect(chtStage.notCalled).to.be.true;
          expect(chtComplete.notCalled).to.be.true;
          expect(streamChanges.notCalled).to.be.true;
        } else {
          expect.fail('Expected error to be thrown');
        }
      })));
    });

    it('streams updates to upgrade log when upgrade is triggered', run(Effect.gen(function* () {
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
      streamChanges.returns(sinon.stub().returns(changesStream));

      const stream = yield* UpgradeService.upgrade(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(streamChanges.calledOnceWithExactly({
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
      expect(chtUpgrade.calledOnceWithExactly(version)).to.be.true;
      expect(chtStage.notCalled).to.be.true;
      expect(chtComplete.notCalled).to.be.true;
    })));

    COMPLETED_STATES.forEach(state => {
      it('stops streaming values when upgrade log has status ', run(Effect.gen(function* () {
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
        streamChanges.returns(sinon.stub().returns(changesStream));

        const stream = yield* UpgradeService.upgrade(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([initUpgradeLog]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(streamChanges.calledOnceWithExactly({
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
        expect(chtUpgrade.calledOnceWithExactly(version)).to.be.true;
        expect(chtStage.notCalled).to.be.true;
        expect(chtComplete.notCalled).to.be.true;
      })));
    });

    it('throws error if an upgrade log cannot be found when upgrade is triggered', run(Effect.gen(function* () {
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
        expect(chtUpgrade.calledOnceWithExactly(version)).to.be.true;
        expect(chtStage.notCalled).to.be.true;
        expect(chtComplete.notCalled).to.be.true;
        expect(streamChanges.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be thrown');
      }
    })));
  });

  describe('stage', () => {
    COMPLETED_STATES.forEach(state => {
      it(`stages upgrade when existing upgrade log completed with state ${state}`, run(Effect.gen(function* () {
        const upgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
        streamChanges.returns(sinon.stub().returns(Stream.empty));

        yield* UpgradeService.stage(version);

        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(dbAllDocs.calledTwice).to.be.true;
        expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(dbAllDocs.args[1][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
        expect(chtUpgrade.notCalled).to.be.true;
        expect(chtStage.calledOnceWithExactly(version)).to.be.true;
        expect(chtComplete.notCalled).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [upgradeLog._id],
        })).to.be.true;
      })));
    });

    IN_PROGRESS_STATES.forEach(state => {
      it(`returns error when there is already an existing upgrade with status ${state}`, run(Effect.gen(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.stage(version));

        if (Either.isLeft(either)) {
          expect(either.left.message).to.equal('Upgrade already in progress.');
          expect(pouchGet.args).to.deep.equal([['medic-logs']]);
          expect(dbAllDocs.calledOnce).to.be.true;
          expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
          expect(chtUpgrade.notCalled).to.be.true;
          expect(chtStage.notCalled).to.be.true;
          expect(chtComplete.notCalled).to.be.true;
          expect(streamChanges.notCalled).to.be.true;
        } else {
          expect.fail('Expected error to be thrown');
        }
      })));
    });

    it('streams updates to upgrade log when upgrade is staged', run(Effect.gen(function* () {
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
      streamChanges.returns(sinon.stub().returns(changesStream));

      const stream = yield* UpgradeService.stage(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(streamChanges.calledOnceWithExactly({
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
      expect(chtUpgrade.notCalled).to.be.true;
      expect(chtStage.calledOnceWithExactly(version)).to.be.true;
      expect(chtComplete.notCalled).to.be.true;
    })));

    ['indexed', ...COMPLETED_STATES].forEach(state => {
      it('stops streaming values when upgrade log has status ', run(Effect.gen(function* () {
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
        streamChanges.returns(sinon.stub().returns(changesStream));

        const stream = yield* UpgradeService.stage(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([initUpgradeLog]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(streamChanges.calledOnceWithExactly({
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
        expect(chtUpgrade.notCalled).to.be.true;
        expect(chtStage.calledOnceWithExactly(version)).to.be.true;
        expect(chtComplete.notCalled).to.be.true;
      })));
    });
  });

  describe('complete', () => {
    it('completes upgrade when existing upgrade log has state indexed', run(Effect.gen(function* () {
      const upgradeLog = createUpgradeLog({ idMillis: 1, state: 'indexed' });
      dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
      streamChanges.returns(sinon.stub().returns(Stream.empty));

      yield* UpgradeService.complete(version);

      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(dbAllDocs.calledTwice).to.be.true;
      expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
      expect(dbAllDocs.args[1][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
      expect(chtUpgrade.notCalled).to.be.true;
      expect(chtStage.notCalled).to.be.true;
      expect(chtComplete.calledOnceWithExactly(version)).to.be.true;
      expect(streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [upgradeLog._id],
      })).to.be.true;
    })));

    [...COMPLETED_STATES, ...IN_PROGRESS_STATES].slice(0, -1).forEach(state => {
      it('returns error when there is no existing upgrade with status indexed', run(Effect.gen(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.complete(version));

        if (Either.isLeft(either)) {
          expect(either.left.message).to.equal('No upgrade ready for completion.');
          expect(pouchGet.args).to.deep.equal([['medic-logs']]);
          expect(dbAllDocs.calledOnce).to.be.true;
          expect(dbAllDocs.args[0][0]).to.deep.include(EXPECTED_ALL_DOCS_OPTS);
          expect(chtUpgrade.notCalled).to.be.true;
          expect(chtStage.notCalled).to.be.true;
          expect(chtComplete.notCalled).to.be.true;
          expect(streamChanges.notCalled).to.be.true;
        } else {
          expect.fail('Expected error to be thrown');
        }
      })));
    });

    it('streams updates to upgrade log when complete is triggered', run(Effect.gen(function* () {
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
      streamChanges.returns(sinon.stub().returns(changesStream));

      const stream = yield* UpgradeService.complete(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
      expect(streamChanges.calledOnceWithExactly({
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
      expect(chtUpgrade.notCalled).to.be.true;
      expect(chtStage.notCalled).to.be.true;
      expect(chtComplete.calledOnceWithExactly(version)).to.be.true;
    })));

    COMPLETED_STATES.forEach(state => {
      it('stops streaming values when upgrade log has status ', run(Effect.gen(function* () {
        const initUpgradeLog = createUpgradeLog({ idMillis: 1, state: 'indexed' });
        dbAllDocs.resolves({ rows: [{ doc: initUpgradeLog }] });
        const expectedUpgradeLogs = [
          { ...initUpgradeLog, state },
          { ...initUpgradeLog, state: 'completing' },
        ];
        const changesStream = Stream
          .fromIterable(expectedUpgradeLogs)
          .pipe(Stream.map(log => ({ doc: log })));
        streamChanges.returns(sinon.stub().returns(changesStream));

        const stream = yield* UpgradeService.complete(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([{ ...initUpgradeLog, state }]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 3));
        expect(streamChanges.calledOnceWithExactly({
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
        expect(chtUpgrade.notCalled).to.be.true;
        expect(chtStage.notCalled).to.be.true;
        expect(chtComplete.calledOnceWithExactly(version)).to.be.true;
      })));
    });
  });
});
