import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import * as CouchDbsInfo from '../../src/libs/couch/dbs-info';
import { CouchDesignInfoService } from '../../src/services/couch/design-info';
import * as CouchDesignDocs from '../../src/libs/couch/design-docs';
import { createDesignInfo } from '../utils/data-models';
import { WarmViewsService } from '../../src/services/warm-views';
import * as CouchDesign from '../../src/libs/couch/design';
import { CouchViewService } from '../../src/services/couch/view';
import { genWithLayer, sandbox } from '../utils/base';
import { ChtClientService } from '../../src/services/cht-client';
import sinon, { SinonStub } from 'sinon';

const viewSvcWarm = sandbox.stub();
const designInfoSvcGet = sandbox.stub();

const run = WarmViewsService.Default.pipe(
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  Layer.provide(Layer.succeed(CouchViewService, {
    warm: viewSvcWarm,
  } as unknown as CouchViewService)),
  Layer.provide(Layer.succeed(CouchDesignInfoService, {
    get: designInfoSvcGet,
  } as unknown as CouchDesignInfoService)),
  genWithLayer,
);

describe('Warm Views Service', () => {
  let designDocsSvcGetNames: SinonStub;
  let designSvcGetViewNames: SinonStub;
  let dbsInfoSvcGetDbNames: SinonStub;

  beforeEach(() => {
    designDocsSvcGetNames = sinon.stub(CouchDesignDocs, 'getDesignDocNames');
    designSvcGetViewNames = sinon.stub(CouchDesign, 'getViewNames');
    dbsInfoSvcGetDbNames = sinon.stub(CouchDbsInfo, 'getDbNames');
  });

  describe('warmAll', () => {
    it('warms all views for all databases', run(function* () {
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
    }));

    it('does not warm anything if no databases are found', run(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed([]));

      yield* WarmViewsService.warmAll();

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designSvcGetViewNames.notCalled).to.be.true;
      expect(viewSvcWarm.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
    }));
  });

  describe('designsCurrentlyUpdating', () => {
    it('returns info about currently updating designs', run(function* () {
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
    }));

    it('returns an empty array when no views are updating', run(function* () {
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
    }));

    it('returns an empty array when no databases are found', run(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed([]));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([]);
      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designSvcGetViewNames.notCalled).to.be.true;
      expect(viewSvcWarm.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
    }));
  });
});
