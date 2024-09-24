import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchDbsInfoService } from '../../src/services/couch/dbs-info';
import { CouchDesignInfoService } from '../../src/services/couch/design-info';
import { CompactService, CompactServiceLive } from '../../src/services/compact';
import { CouchDesignDocsService } from '../../src/services/couch/design-docs';
import { CouchCompactService } from '../../src/services/couch/compact';
import { createDbInfo, createDesignInfo } from '../utils/data-models';


describe('Compact service', () => {
  let dbsInfoSvcGetDbNames: SinonStub;
  let dbInfoSvcGet: SinonStub;
  let designDocsSvcGetNames: SinonStub;
  let compactSvcCompactDb: SinonStub;
  let compactSvcCompactDesign: SinonStub;
  let designInfoSvcGet: SinonStub;

  beforeEach(() => {
    dbsInfoSvcGetDbNames = sinon.stub();
    dbInfoSvcGet = sinon.stub();
    designDocsSvcGetNames = sinon.stub();
    compactSvcCompactDb = sinon.stub();
    compactSvcCompactDesign = sinon.stub();
    designInfoSvcGet = sinon.stub();
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CompactService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CompactServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchDbsInfoService, CouchDbsInfoService.of({
        getDbNames: dbsInfoSvcGetDbNames,
        get: dbInfoSvcGet,
      } as unknown as CouchDbsInfoService))),
      Effect.provide(Layer.succeed(CouchDesignDocsService, CouchDesignDocsService.of({
        getNames: designDocsSvcGetNames,
      }))),
      Effect.provide(Layer.succeed(CouchCompactService, CouchCompactService.of({
        compactDb: compactSvcCompactDb,
        compactDesign: compactSvcCompactDesign,
      }))),
      Effect.provide(Layer.succeed(CouchDesignInfoService, CouchDesignInfoService.of({
        get: designInfoSvcGet,
      }))),
    ));
  };

  describe('compactAll', () => {
    it('compacts all databases and views', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test']));
      compactSvcCompactDb.returns(Effect.void);
      compactSvcCompactDesign.returns(Effect.void);
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed(['test-client']));

      const service = yield* CompactService;
      yield* service.compactAll();

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(compactSvcCompactDesign.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['test', 'test-client'],
      ]);
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test']]);
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));

    it('compacts only databases when no views found', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test']));
      compactSvcCompactDb.returns(Effect.void);
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed([]));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed([]));

      const service = yield* CompactService;
      yield* service.compactAll();

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test']]);
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));

    it('compacts nothing if no databases found', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed([]));

      const service = yield* CompactService;
      yield* service.compactAll();

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.notCalled).to.be.true;
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));
  });

  describe('currentlyCompacting', () => {
    it('returns all databases and views currently compacting', run(Effect.gen(function* () {
      const medicDbInfo = createDbInfo({ key: 'medic', compact_running: true });
      const testDbInfo = createDbInfo({ key: 'test', compact_running: false });
      const sentinelDbInfo = createDbInfo({ key: 'sentinel', compact_running: true });
      const usersDbInfo = createDbInfo({ key: '_users', compact_running: false });
      dbInfoSvcGet.returns(Effect.succeed([medicDbInfo, testDbInfo, sentinelDbInfo, usersDbInfo]));
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed(['test-client']));
      designDocsSvcGetNames.withArgs('sentinel').returns(Effect.succeed(['sentinel']));
      designDocsSvcGetNames.withArgs('_users').returns(Effect.succeed([]));
      const medicClientDesignInfo = createDesignInfo({ name: 'medic-client', compact_running: true });
      const medicSmsDesignInfo = createDesignInfo({ name: 'medic-sms', compact_running: false });
      const testClientDesignInfo = createDesignInfo({ name: 'test-client', compact_running: true });
      const sentinelDesignInfo = createDesignInfo({ name: 'sentinel', compact_running: false });
      designInfoSvcGet.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      designInfoSvcGet.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      designInfoSvcGet.withArgs('test', 'test-client').returns(Effect.succeed(testClientDesignInfo));
      designInfoSvcGet.withArgs('sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));

      const service = yield* CompactService;
      const compacting = yield* service.currentlyCompacting();

      expect(compacting).to.deep.equal([
        'medic/medic-client',
        'medic',
        'test/test-client',
        'sentinel',
      ]);
      expect(dbsInfoSvcGetDbNames.notCalled).to.be.true;
      expect(dbInfoSvcGet.calledOnceWithExactly()).to.be.true;
      expect(compactSvcCompactDb.notCalled).to.be.true;
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test'], ['sentinel'], ['_users']]);
      expect(designInfoSvcGet.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['test', 'test-client'],
        ['sentinel', 'sentinel'],
      ]);
    })));

    it('returns empty array if no databases found', run(Effect.gen(function* () {
      dbInfoSvcGet.returns(Effect.succeed([]));

      const service = yield* CompactService;
      const compacting = yield* service.currentlyCompacting();

      expect(compacting).to.deep.equal([]);
      expect(dbsInfoSvcGetDbNames.notCalled).to.be.true;
      expect(dbInfoSvcGet.calledOnceWithExactly()).to.be.true;
      expect(compactSvcCompactDb.notCalled).to.be.true;
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));
  });
});
