import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchDbsInfoService } from '../../src/services/couch/dbs-info';
import { CouchDesignInfoService } from '../../src/services/couch/design-info';
import { CouchDesignDocsService } from '../../src/services/couch/design-docs';
import { createDesignInfo } from '../utils/data-models';
import { WarmViewsService } from '../../src/services/warm-views';
import { CouchDesignService } from '../../src/services/couch/design';
import { CouchViewService } from '../../src/services/couch/view';

describe('Warm Views Service', () => {
  let dbsInfoSvcGetDbNames: SinonStub;
  let designDocsSvcGetNames: SinonStub;
  let designSvcGetViewNames: SinonStub;
  let viewSvcWarm: SinonStub;
  let designInfoSvcGet: SinonStub;

  beforeEach(() => {
    dbsInfoSvcGetDbNames = sinon.stub();
    designDocsSvcGetNames = sinon.stub();
    designSvcGetViewNames = sinon.stub();
    viewSvcWarm = sinon.stub();
    designInfoSvcGet = sinon.stub();
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, WarmViewsService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(WarmViewsService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchDbsInfoService, {
        getDbNames: dbsInfoSvcGetDbNames,
      } as unknown as CouchDbsInfoService)),
      Effect.provide(Layer.succeed(CouchDesignDocsService, {
        getNames: designDocsSvcGetNames,
      } as unknown as CouchDesignDocsService)),
      Effect.provide(Layer.succeed(CouchDesignService, {
        getViewNames: designSvcGetViewNames,
      } as unknown as CouchDesignService)),
      Effect.provide(Layer.succeed(CouchViewService, {
        warm: viewSvcWarm,
      } as unknown as CouchViewService)),
      Effect.provide(Layer.succeed(CouchDesignInfoService, {
        get: designInfoSvcGet,
      } as unknown as CouchDesignInfoService)),
    ));
  };

  describe('warmAll', () => {
    it('warms all views for all databases', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test', 'sentinel']));
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed(['test-client']));
      designDocsSvcGetNames.withArgs('sentinel').returns(Effect.succeed([]));
      designSvcGetViewNames.withArgs('medic', 'medic-client').returns(Effect.succeed(['view1', 'view2']));
      designSvcGetViewNames.withArgs('medic', 'medic-sms').returns(Effect.succeed(['view3']));
      designSvcGetViewNames.withArgs('test', 'test-client').returns(Effect.succeed(['view4']));
      viewSvcWarm.returns(Effect.void);

      yield* WarmViewsService.warmAll();

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test'], ['sentinel']]);
      expect(designSvcGetViewNames.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['test', 'test-client']
      ]);
      expect(viewSvcWarm.args).to.deep.equal([
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
        ['medic', 'medic-sms', 'view3'],
        ['test', 'test-client', 'view4'],
      ]);
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));

    it('does not warm anything if no databases are found', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed([]));

      yield* WarmViewsService.warmAll();

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designSvcGetViewNames.notCalled).to.be.true;
      expect(viewSvcWarm.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));
  });

  describe('designsCurrentlyUpdating', () => {
    it('returns info about currently updating designs', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test', 'sentinel']));
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms', 'medic']));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed(['test-client']));
      designDocsSvcGetNames.withArgs('sentinel').returns(Effect.succeed([]));
      designInfoSvcGet
        .withArgs('medic', 'medic-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-client', updater_running: true })));
      designInfoSvcGet
        .withArgs('medic', 'medic-sms')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-sms', updater_running: true })));
      designInfoSvcGet
        .withArgs('medic', 'medic')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic', updater_running: false })));
      designInfoSvcGet
        .withArgs('test', 'test-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'test-client', updater_running: true })));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([
        { dbName: 'medic', designId: 'medic-client' },
        { dbName: 'medic', designId: 'medic-sms' },
        { dbName: 'test', designId: 'test-client' },
      ]);
      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test'], ['sentinel']]);
      expect(designSvcGetViewNames.notCalled).to.be.true;
      expect(viewSvcWarm.notCalled).to.be.true;
      expect(designInfoSvcGet.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['medic', 'medic'],
        ['test', 'test-client'],
      ]);
    })));

    it('returns an empty array when no views are updating', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test', 'sentinel']));
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms', 'medic']));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed(['test-client']));
      designDocsSvcGetNames.withArgs('sentinel').returns(Effect.succeed([]));
      designInfoSvcGet
        .withArgs('medic', 'medic-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-client', updater_running: false })));
      designInfoSvcGet
        .withArgs('medic', 'medic-sms')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-sms', updater_running: false })));
      designInfoSvcGet
        .withArgs('medic', 'medic')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic', updater_running: false })));
      designInfoSvcGet
        .withArgs('test', 'test-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'test-client', updater_running: false })));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([]);
      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test'], ['sentinel']]);
      expect(designSvcGetViewNames.notCalled).to.be.true;
      expect(viewSvcWarm.notCalled).to.be.true;
      expect(designInfoSvcGet.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['medic', 'medic'],
        ['test', 'test-client'],
      ]);
    })));

    it('returns an empty array when no databases are found', run(Effect.gen(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed([]));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([]);
      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designSvcGetViewNames.notCalled).to.be.true;
      expect(viewSvcWarm.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
    })));
  });
});
