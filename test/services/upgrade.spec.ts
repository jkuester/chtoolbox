import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Either, Encoding, Layer, Option, pipe, Stream } from 'effect';
import sinon from 'sinon';
import { PouchDBService } from '../../src/services/pouchdb.ts';
import { expect } from 'chai';
import * as UpgradeSvc from '../../src/services/upgrade.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import esmock from 'esmock';
import { WarmViewsService } from '../../src/services/warm-views.ts';
import { createActiveTask } from '../utils/data-models.ts';

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
const warmDesign = sandbox.stub();
const mockPouchSvc = {
  getDoc: sandbox.stub(),
  saveDoc: sandbox.stub(),
  streamChanges: sandbox.stub()
};
const mockUpgradeLib = {
  upgradeCht: sandbox.stub(),
  stageChtUpgrade: sandbox.stub(),
  completeChtUpgrade: sandbox.stub(),
};
const mockCore = { pouchDB: sandbox.stub() };
const compareRefs = sandbox.stub();
const mockGitHubLib = {
  compareRefs: sandbox.stub().returns(compareRefs),
};

const { UpgradeService } = await esmock<typeof UpgradeSvc>('../../src/services/upgrade.ts', {
  '../../src/libs/core.ts': mockCore,
  '../../src/services/pouchdb.ts': mockPouchSvc,
  '../../src/libs/cht/upgrade.ts': mockUpgradeLib,
  '../../src/libs/github.ts': mockGitHubLib
});
const run = UpgradeService.Default.pipe(
  Layer.provideMerge(Layer.succeed(ChtClientService, { } as unknown as ChtClientService)),
  Layer.provide(Layer.succeed(PouchDBService, {
    get: pouchGet,
  } as unknown as PouchDBService),),
  Layer.provide(Layer.succeed(WarmViewsService, { warmDesign } as unknown as WarmViewsService)),
  genWithLayer,
);

describe('Upgrade Service', () => {
  beforeEach(() => pouchGet.returns(Effect.succeed({ allDocs: dbAllDocs, })));

  describe('upgrade', () => {
    COMPLETED_STATES.forEach(state => {
      it(`triggers upgrade when existing upgrade log completed with state ${state}`, run(function* () {
        const upgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
        const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
        mockPouchSvc.streamChanges.returns(streamChanges);

        yield* UpgradeService.upgrade(version);

        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
        expect(dbAllDocs).to.have.been.calledTwice;
        expect(dbAllDocs).to.always.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
        expect(mockUpgradeLib.upgradeCht.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
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
          expect(dbAllDocs).to.have.been.calledOnce;
          expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
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
      const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
      mockPouchSvc.streamChanges.returns(streamChanges);

      const stream = yield* UpgradeService.upgrade(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
      expect(streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [initUpgradeLog._id],
      })).to.be.true;
      expect(dbAllDocs).to.have.been.calledTwice;
      expect(dbAllDocs).to.always.have.been.calledWithMatch({
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
        const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
        mockPouchSvc.streamChanges.returns(streamChanges);

        const stream = yield* UpgradeService.upgrade(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([initUpgradeLog]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [initUpgradeLog._id],
        })).to.be.true;
        expect(dbAllDocs).to.have.been.calledTwice;
        expect(dbAllDocs).to.always.have.been.calledWithMatch({
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
        expect(dbAllDocs).to.have.been.calledTwice;
        expect(dbAllDocs).to.always.have.been.calledWithMatch({
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
        const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
        mockPouchSvc.streamChanges.returns(streamChanges);

        yield* UpgradeService.stage(version);

        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
        expect(dbAllDocs).to.have.been.calledTwice;
        expect(dbAllDocs).to.always.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
        expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
        expect(mockUpgradeLib.stageChtUpgrade.calledOnceWithExactly(version)).to.be.true;
        expect(mockUpgradeLib.completeChtUpgrade.notCalled).to.be.true;
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
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
          expect(dbAllDocs).to.have.been.calledOnce;
          expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
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
      const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
      mockPouchSvc.streamChanges.returns(streamChanges);

      const stream = yield* UpgradeService.stage(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
      expect(streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [initUpgradeLog._id],
      })).to.be.true;
      expect(dbAllDocs).to.have.been.calledTwice;
      expect(dbAllDocs).to.always.have.been.calledWithMatch({
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
        const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
        mockPouchSvc.streamChanges.returns(streamChanges);

        const stream = yield* UpgradeService.stage(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([initUpgradeLog]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [initUpgradeLog._id],
        })).to.be.true;
        expect(dbAllDocs).to.have.been.calledTwice;
        expect(dbAllDocs).to.always.have.been.calledWithMatch({
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
      const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
      mockPouchSvc.streamChanges.returns(streamChanges);

      yield* UpgradeService.complete(version);

      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
      expect(dbAllDocs).to.have.been.calledTwice;
      expect(dbAllDocs).to.always.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
      expect(mockUpgradeLib.upgradeCht.notCalled).to.be.true;
      expect(mockUpgradeLib.stageChtUpgrade.notCalled).to.be.true;
      expect(mockUpgradeLib.completeChtUpgrade.calledOnceWithExactly(version)).to.be.true;
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
      expect(streamChanges.calledOnceWithExactly({
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
          expect(dbAllDocs).to.have.been.calledOnce;
          expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
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
      const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
      mockPouchSvc.streamChanges.returns(streamChanges);

      const stream = yield* UpgradeService.complete(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal(expectedUpgradeLogs);
      expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
      expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
      expect(streamChanges.calledOnceWithExactly({
        include_docs: true,
        doc_ids: [initUpgradeLog._id],
      })).to.be.true;
      expect(dbAllDocs).to.have.been.calledTwice;
      expect(dbAllDocs).to.always.have.been.calledWithMatch({
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
        const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
        mockPouchSvc.streamChanges.returns(streamChanges);

        const stream = yield* UpgradeService.complete(version);
        const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

        expect(results).to.deep.equal([{ ...initUpgradeLog, state }]);
        expect(pouchGet.args).to.deep.equal(Array.replicate(['medic-logs'], 2));
        expect(mockPouchSvc.streamChanges.calledOnceWithExactly('medic-logs')).to.be.true;
        expect(streamChanges.calledOnceWithExactly({
          include_docs: true,
          doc_ids: [initUpgradeLog._id],
        })).to.be.true;
        expect(dbAllDocs).to.have.been.calledTwice;
        expect(dbAllDocs).to.always.have.been.calledWithMatch({
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

  describe('preStage', () => {
    const STAGING_BUILDS_COUCH_URL = 'https://staging.dev.medicmobile.org/_couch/builds_4';
    const fakeDb = { get: () => null } as unknown as PouchDB.Database;

    const medicClientDdoc = {
      _id: '_design/medic-client',
      views: {
        'contacts_by_freetext': {},
        'contacts_by_last_visited': {},
        'contacts_by_parent': {},
      },
    };
    const medicDdoc = {
      _id: '_design/medic',
      views: {
        'contacts_by_depth': {},
        'contacts_by_primary_contact': {},
        'doc_summaries_by_id': {},
      },
    };
    const medicDdocAttachment = { docs: [medicDdoc, medicClientDdoc] };

    const sentinelDdoc = { _id: '_design/sentinel', views: { 'outbound_push_tasks': {} } };
    const sentinelDdocAttachment = { docs: [sentinelDdoc] };

    const logsDdoc = { _id: '_design/logs', views: {
      'connected_users': {},
      'replication_limit': {}
    } };
    const logsDdocAttachment = { docs: [logsDdoc] };

    const usersMetaDdoc = { _id: '_design/users-meta', views: {
      'device_by_user': {},
      'feedback_by_date': {}
    } };
    const usersMetaDdocAttachment = { docs: [usersMetaDdoc] };

    const usersDdoc = { _id: '_design/users', views: { 'users_by_field': {} }};
    const usersDdocAttachment = { docs: [usersDdoc] };

    const medicActiveTask = createActiveTask({ database: 'medic', design_document: medicDdoc._id });
    const medicClientActiveTask = createActiveTask({ database: 'medic', design_document: medicClientDdoc._id });
    const sentinelActiveTask = createActiveTask({ database: 'medic-sentinel', design_document: sentinelDdoc._id });
    const logsActiveTask = createActiveTask({ database: 'medic-logs', design_document: logsDdoc._id });
    const usersMetaActiveTask = createActiveTask({ database: 'medic-users-meta', design_document: usersMetaDdoc._id });
    const usersActiveTask = createActiveTask({ database: '_users', design_document: usersDdoc._id });

    const deploy_info = { user: 'Pre-staged by chtoolbox' };

    let stageingDbGet: sinon.SinonStub;
    let getDoc: sinon.SinonStub;
    let saveDoc: sinon.SinonStub;

    beforeEach(() => {
      stageingDbGet = sinon.stub(fakeDb, 'get');
      mockCore.pouchDB.returns(fakeDb);
      getDoc = sinon.stub();
      mockPouchSvc.getDoc.returns(getDoc);
      saveDoc = sinon.stub();
      mockPouchSvc.saveDoc.returns(saveDoc);
      stageingDbGet.resolves({ _attachments: {
        'ddocs/medic.json': { data: pipe(medicDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
        'ddocs/sentinel.json': { data: pipe(sentinelDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
        'ddocs/logs.json': { data: pipe(logsDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
        'ddocs/users-meta.json': { data: pipe(usersMetaDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
        'ddocs/users.json': { data: pipe(usersDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
      } });
      warmDesign.withArgs('medic', ':staged:medic').returns(Stream.succeed([medicActiveTask]));
      warmDesign.withArgs('medic', ':staged:medic-client').returns(Stream.succeed([medicClientActiveTask]));
      warmDesign.withArgs('medic-sentinel', ':staged:sentinel').returns(Stream.succeed([sentinelActiveTask]));
      warmDesign.withArgs('medic-logs', ':staged:logs').returns(Stream.succeed([logsActiveTask]));
      warmDesign.withArgs('medic-users-meta', ':staged:users-meta').returns(Stream.succeed([usersMetaActiveTask]));
      warmDesign.withArgs('_users', ':staged:users').returns(Stream.succeed([usersActiveTask]));
      saveDoc.returns(Effect.void);
    });

    it('sequentially pre-stages each design doc for a version and streams active tasks', run(function* () {
      dbAllDocs.onFirstCall().resolves({ rows: [] });
      getDoc.returns(Effect.succeed(Option.none()));

      const stream = yield* UpgradeService.preStage(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal([
        [medicActiveTask],
        [medicClientActiveTask],
        [sentinelActiveTask],
        [logsActiveTask],
        [usersMetaActiveTask],
        [usersActiveTask]
      ]);
      expect(dbAllDocs).to.have.been.calledOnce;
      expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
      expect(mockCore.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
      expect(stageingDbGet.calledOnceWithExactly(`medic:medic:${version}`, { attachments: true })).to.be.true;
      expect(warmDesign.args).to.deep.equal([
        ['medic', ':staged:medic'],
        ['medic', ':staged:medic-client'],
        ['medic-sentinel', ':staged:sentinel'],
        ['medic-logs', ':staged:logs'],
        ['medic-users-meta', ':staged:users-meta'],
        ['_users', ':staged:users'],
      ]);
      expect(mockPouchSvc.getDoc.args).to.deep.equal([
        ['medic'], ['medic'], ['medic-sentinel'], ['medic-logs'], ['medic-users-meta'], ['_users']
      ]);
      expect(getDoc.args).to.deep.equal([
        ['_design/:staged:medic'],
        ['_design/:staged:medic-client'],
        ['_design/:staged:sentinel'],
        ['_design/:staged:logs'],
        ['_design/:staged:users-meta'],
        ['_design/:staged:users']
      ]);
      expect(mockPouchSvc.saveDoc.args).to.deep.equal([
        ['medic'], ['medic'], ['medic-sentinel'], ['medic-logs'], ['medic-users-meta'], ['_users']
      ]);
      expect(saveDoc.args).to.deep.equal([
        [{ ...medicDdoc, _id: '_design/:staged:medic', deploy_info }],
        [{ ...medicClientDdoc, _id: '_design/:staged:medic-client', deploy_info }],
        [{ ...sentinelDdoc, _id: '_design/:staged:sentinel', deploy_info }],
        [{ ...logsDdoc, _id: '_design/:staged:logs', deploy_info }],
        [{ ...usersMetaDdoc, _id: '_design/:staged:users-meta', deploy_info }],
        [{ ...usersDdoc, _id: '_design/:staged:users', deploy_info }],
      ]);
    }));

    it('pre-stages updated design docs when existing staged ddocs exist', run(function* () {
      dbAllDocs.resolves({ rows: [] });
      const medicRev = '1';
      const medicClientRev = '2';
      const logsRev = '3';
      const sentinelRev = '4';
      const usersMetaRev = '5';
      const usersRev = '6';
      getDoc.withArgs('_design/:staged:medic').returns(Effect.succeed(Option.some({ _rev: medicRev })));
      getDoc.withArgs('_design/:staged:medic-client').returns(Effect.succeed(Option.some({ _rev: medicClientRev })));
      getDoc.withArgs('_design/:staged:sentinel').returns(Effect.succeed(Option.some({ _rev: sentinelRev })));
      getDoc.withArgs('_design/:staged:logs').returns(Effect.succeed(Option.some({ _rev: logsRev })));
      getDoc.withArgs('_design/:staged:users-meta').returns(Effect.succeed(Option.some({ _rev: usersMetaRev })));
      getDoc.withArgs('_design/:staged:users').returns(Effect.succeed(Option.some({ _rev: usersRev })));

      const stream = yield* UpgradeService.preStage(version);
      const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(results).to.deep.equal([
        [medicActiveTask],
        [medicClientActiveTask],
        [sentinelActiveTask],
        [logsActiveTask],
        [usersMetaActiveTask],
        [usersActiveTask]
      ]);
      expect(dbAllDocs).to.have.been.calledOnce;
      expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
      expect(mockCore.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
      expect(stageingDbGet.calledOnceWithExactly(`medic:medic:${version}`, { attachments: true })).to.be.true;
      expect(warmDesign.args).to.deep.equal([
        ['medic', ':staged:medic'],
        ['medic', ':staged:medic-client'],
        ['medic-sentinel', ':staged:sentinel'],
        ['medic-logs', ':staged:logs'],
        ['medic-users-meta', ':staged:users-meta'],
        ['_users', ':staged:users'],
      ]);
      expect(mockPouchSvc.getDoc.args).to.deep.equal([
        ['medic'], ['medic'], ['medic-sentinel'], ['medic-logs'], ['medic-users-meta'], ['_users']
      ]);
      expect(getDoc.args).to.deep.equal([
        ['_design/:staged:medic'],
        ['_design/:staged:medic-client'],
        ['_design/:staged:sentinel'],
        ['_design/:staged:logs'],
        ['_design/:staged:users-meta'],
        ['_design/:staged:users']
      ]);
      expect(mockPouchSvc.saveDoc.args).to.deep.equal([
        ['medic'], ['medic'], ['medic-sentinel'], ['medic-logs'], ['medic-users-meta'], ['_users']
      ]);
      expect(saveDoc.args).to.deep.equal([
        [{ ...medicDdoc, _id: '_design/:staged:medic', _rev: medicRev, deploy_info }],
        [{ ...medicClientDdoc, _id: '_design/:staged:medic-client', _rev: medicClientRev, deploy_info }],
        [{ ...sentinelDdoc, _id: '_design/:staged:sentinel', _rev: sentinelRev, deploy_info }],
        [{ ...logsDdoc, _id: '_design/:staged:logs', _rev: logsRev, deploy_info }],
        [{ ...usersMetaDdoc, _id: '_design/:staged:users-meta', _rev: usersMetaRev, deploy_info }],
        [{ ...usersDdoc, _id: '_design/:staged:users', _rev: usersRev, deploy_info }],
      ]);
    }));

    COMPLETED_STATES.forEach(state => {
      it(`pre-stages upgrade when existing upgrade log completed with state ${state}`, run(function* () {
        const upgradeLog = createUpgradeLog({ idMillis: 1, state });
        dbAllDocs.resolves({ rows: [{ doc: upgradeLog }] });
        getDoc.returns(Effect.succeed(Option.none()));

        yield* UpgradeService.preStage(version);

        expect(dbAllDocs).to.have.been.calledOnce;
        expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
        expect(mockCore.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
        expect(stageingDbGet.calledOnceWithExactly(`medic:medic:${version}`, { attachments: true })).to.be.true;
        expect(warmDesign.args).to.deep.equal([
          ['medic', ':staged:medic'],
          ['medic', ':staged:medic-client'],
          ['medic-sentinel', ':staged:sentinel'],
          ['medic-logs', ':staged:logs'],
          ['medic-users-meta', ':staged:users-meta'],
          ['_users', ':staged:users'],
        ]);
        expect(mockPouchSvc.getDoc.args).to.deep.equal([
          ['medic'], ['medic'], ['medic-sentinel'], ['medic-logs'], ['medic-users-meta'], ['_users']
        ]);
        expect(getDoc.args).to.deep.equal([
          ['_design/:staged:medic'],
          ['_design/:staged:medic-client'],
          ['_design/:staged:sentinel'],
          ['_design/:staged:logs'],
          ['_design/:staged:users-meta'],
          ['_design/:staged:users']
        ]);
        expect(mockPouchSvc.saveDoc.args).to.deep.equal([
          ['medic'], ['medic'], ['medic-sentinel'], ['medic-logs'], ['medic-users-meta'], ['_users']
        ]);
        // We don't actually save the ddoc until we start streaming.
        expect(saveDoc.notCalled).to.be.true;
      }));
    });

    IN_PROGRESS_STATES.forEach(state => {
      it(`returns error when there is already an existing upgrade with status ${state}`, run(function* () {
        dbAllDocs.resolves({ rows: [{
          doc: createUpgradeLog({ state })
        }] });

        const either = yield* Effect.either(UpgradeService.preStage(version));

        if (Either.isRight(either)) {
          expect.fail('Expected error to be thrown');
        }

        expect(either.left.message).to.equal('Upgrade already in progress.');
        expect(dbAllDocs).to.have.been.calledOnce;
        expect(dbAllDocs).to.have.been.calledWithMatch(EXPECTED_ALL_DOCS_OPTS);
        expect(mockCore.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
        expect(stageingDbGet.notCalled).to.be.true;
        expect(warmDesign.notCalled).to.be.true;
        expect(mockPouchSvc.getDoc.notCalled).to.be.true;
        expect(getDoc.notCalled).to.be.true;
        expect(mockPouchSvc.saveDoc.notCalled).to.be.true;
        expect(saveDoc.notCalled).to.be.true;
      }));
    });
  });

  describe('getReleaseDiff', () => {
    const baseTag = '1.0.0';
    const headTag = '2.0.0';

    it('returns updated ddocs grouped by db and htmlUrl', run(function* () {
      const diffData = {
        html_url: 'https://example.com/diff',
        files: [
          { filename: 'ddocs/medic-db/medic/views/foo/map.js' },
          { filename: 'ddocs/medic-db/medic-client/views/bar/map.js' },
          { filename: 'ddocs/medic-db/medic/views/foo/reduce.js' }, // duplicate ddoc to test dedupe
          { filename: 'ddocs/users-db/users/views/baz/map.js' },
          { filename: 'README.md' }, // non matching file
        ],
      };
      compareRefs.returns(Effect.succeed(diffData));

      const result = yield* UpgradeService.getReleaseDiff(baseTag, headTag);

      expect(result).to.deep.equal({
        updatedDdocs: {
          medic: ['medic', 'medic-client'],
          users: ['users']
        },
        htmlUrl: diffData.html_url,
      });
      expect(compareRefs).to.have.been.calledOnceWithExactly(baseTag, headTag);
    }));

    it('returns empty updatedDdocs when files is undefined', run(function* () {
      const diffData = {
        html_url: 'https://example.com/diff',
        files: undefined,
      };
      compareRefs.returns(Effect.succeed(diffData));

      const result = yield* UpgradeService.getReleaseDiff(baseTag, headTag);

      expect(result).to.deep.equal({ updatedDdocs: { }, htmlUrl: diffData.html_url });
      expect(compareRefs).to.have.been.calledOnceWithExactly(baseTag, headTag);
    }));
  });
});
