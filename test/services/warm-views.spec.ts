import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Stream, Array } from 'effect';
import { expect } from 'chai';
import { createDesignInfo } from '../utils/data-models.ts';
import * as WarmViewsSvc from '../../src/services/warm-views.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import esmock from 'esmock';
import sinon, { type SinonStub } from 'sinon';
import { TimeoutException } from 'effect/Cause';

const mockViewLib = { warmView: sandbox.stub() };
const mockNouveauLib = { warmNouveau: sandbox.stub() };
const mockDesignInfoLib = { getDesignInfo: sandbox.stub() };
const mockDesignDocsLib = { getDesignDocNames: sandbox.stub() };
const mockDesignLib = { getViewNames: sandbox.stub(), getCouchDesign: sandbox.stub() };
const mockDbsInfoLib = { getDbNames: sandbox.stub() };
const getActiveTasks = sandbox.stub();
const mockActiveTasksLib = {
  filterStreamByType: sandbox.stub(),
  filterStreamByDesign: sandbox.stub(),
  streamActiveTasks: sandbox.stub(),
  activeTasksEffect: Effect.suspend(getActiveTasks),
};

const { WarmViewsService } = await esmock<typeof WarmViewsSvc>('../../src/services/warm-views.ts', {
  '../../src/libs/couch/active-tasks.ts': mockActiveTasksLib,
  '../../src/libs/couch/dbs-info.ts': mockDbsInfoLib,
  '../../src/libs/couch/design-info.ts': mockDesignInfoLib,
  '../../src/libs/couch/design-docs.ts': mockDesignDocsLib,
  '../../src/libs/couch/design.ts': mockDesignLib,
  '../../src/libs/couch/nouveau.ts': mockNouveauLib,
  '../../src/libs/couch/view.ts': mockViewLib,
});
const run = WarmViewsService.Default.pipe(
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  genWithLayer,
);

describe('Warm Views Service', () => {
  describe('warmAll', () => {
    it('warms all views for all databases', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed(['medic', 'test', 'sentinel']));
      mockDesignDocsLib.getDesignDocNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      mockDesignDocsLib.getDesignDocNames.withArgs('test').returns(Effect.succeed(['test-client']));
      mockDesignDocsLib.getDesignDocNames.withArgs('sentinel').returns(Effect.succeed([]));
      mockDesignLib.getViewNames.withArgs('medic', 'medic-client').returns(Effect.succeed(['view1', 'view2']));
      mockDesignLib.getViewNames.withArgs('medic', 'medic-sms').returns(Effect.succeed(['view3']));
      mockDesignLib.getViewNames.withArgs('test', 'test-client').returns(Effect.succeed(['view4']));
      mockViewLib.warmView.returns(Effect.void);

      yield* WarmViewsService.warmAll();

      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.args).to.deep.equal([['medic'], ['test'], ['sentinel']]);
      expect(mockDesignLib.getViewNames.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['test', 'test-client']
      ]);
      expect(mockViewLib.warmView.args).to.deep.equal([
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
        ['medic', 'medic-sms', 'view3'],
        ['test', 'test-client', 'view4'],
      ]);
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
    }));

    it('does not warm anything if no databases are found', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed([]));

      yield* WarmViewsService.warmAll();

      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.notCalled).to.be.true;
      expect(mockDesignLib.getViewNames.notCalled).to.be.true;
      expect(mockViewLib.warmView.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
    }));
  });

  describe('designsCurrentlyUpdating', () => {
    it('returns info about currently updating designs', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed(['medic', 'test', 'sentinel']));
      mockDesignDocsLib.getDesignDocNames
        .withArgs('medic')
        .returns(Effect.succeed(['medic-client', 'medic-sms', 'medic']));
      mockDesignDocsLib.getDesignDocNames.withArgs('test').returns(Effect.succeed(['test-client']));
      mockDesignDocsLib.getDesignDocNames.withArgs('sentinel').returns(Effect.succeed([]));
      mockDesignInfoLib.getDesignInfo
        .withArgs('medic', 'medic-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-client', updater_running: true })));
      mockDesignInfoLib.getDesignInfo
        .withArgs('medic', 'medic-sms')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-sms', updater_running: true })));
      mockDesignInfoLib.getDesignInfo
        .withArgs('medic', 'medic')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic', updater_running: false })));
      mockDesignInfoLib.getDesignInfo
        .withArgs('test', 'test-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'test-client', updater_running: true })));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([
        { dbName: 'medic', designId: 'medic-client' },
        { dbName: 'medic', designId: 'medic-sms' },
        { dbName: 'test', designId: 'test-client' },
      ]);
      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.args).to.deep.equal([['medic'], ['test'], ['sentinel']]);
      expect(mockDesignLib.getViewNames.notCalled).to.be.true;
      expect(mockViewLib.warmView.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['medic', 'medic'],
        ['test', 'test-client'],
      ]);
    }));

    it('returns an empty array when no views are updating', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed(['medic', 'test', 'sentinel']));
      mockDesignDocsLib.getDesignDocNames
        .withArgs('medic')
        .returns(Effect.succeed(['medic-client', 'medic-sms', 'medic']));
      mockDesignDocsLib.getDesignDocNames.withArgs('test').returns(Effect.succeed(['test-client']));
      mockDesignDocsLib.getDesignDocNames.withArgs('sentinel').returns(Effect.succeed([]));
      mockDesignInfoLib.getDesignInfo
        .withArgs('medic', 'medic-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-client', updater_running: false })));
      mockDesignInfoLib.getDesignInfo
        .withArgs('medic', 'medic-sms')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic-sms', updater_running: false })));
      mockDesignInfoLib.getDesignInfo
        .withArgs('medic', 'medic')
        .returns(Effect.succeed(createDesignInfo({ name: 'medic', updater_running: false })));
      mockDesignInfoLib.getDesignInfo
        .withArgs('test', 'test-client')
        .returns(Effect.succeed(createDesignInfo({ name: 'test-client', updater_running: false })));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([]);
      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.args).to.deep.equal([['medic'], ['test'], ['sentinel']]);
      expect(mockDesignLib.getViewNames.notCalled).to.be.true;
      expect(mockViewLib.warmView.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['medic', 'medic'],
        ['test', 'test-client'],
      ]);
    }));

    it('returns an empty array when no databases are found', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed([]));

      const designs = yield* WarmViewsService.designsCurrentlyUpdating();

      expect(designs).to.deep.equal([]);
      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.notCalled).to.be.true;
      expect(mockDesignLib.getViewNames.notCalled).to.be.true;
      expect(mockViewLib.warmView.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
    }));
  });

  describe('warmDesign', () => {
    let warmNouveauInner: SinonStub;

    beforeEach(() => {
      mockActiveTasksLib.filterStreamByType.returns(sinon.stub().returnsArg(0));
      mockActiveTasksLib.filterStreamByDesign.returns(sinon.stub().returnsArg(0));
      warmNouveauInner = sinon.stub();
      warmNouveauInner.returns(Effect.void);
      mockNouveauLib.warmNouveau.returns(warmNouveauInner);
    });

    it('warms the views for the given design doc', run(function* () {
      const expectedTasks = [
        { type: 'indexer', design_document: '_design/medic-client', database: 'shards/aaaaa/medic.123456' },
        { type: 'not-indexer', design_document: '_design/medic', database: 'shards/aaaaa/medic.123456' }
      ];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      const ddoc = {
        _id: '_design/medic-client',
        views: {
          view1: {},
          view2: {}
        },
      };
      mockDesignLib.getCouchDesign.returns(Effect.succeed(ddoc));
      mockDesignInfoLib.getDesignInfo.returns(Effect.succeed(createDesignInfo({
        name: 'test-client', updater_running: false
      })));
      mockViewLib.warmView.returns(Effect.void);
      getActiveTasks.returns(Effect.succeed([]));

      const stream = yield* WarmViewsService.warmDesign('medic', 'medic-client');
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('indexer', 'search_indexer')).to.be.true;
      expect(mockActiveTasksLib.filterStreamByDesign.calledOnceWithExactly('medic', '_design/medic-client')).to.be.true;
      expect(mockDesignLib.getViewNames).to.not.have.been.called;
      expect(mockDesignLib.getCouchDesign).to.have.been.calledOnceWithExactly('medic', 'medic-client');
      expect(mockDesignInfoLib.getDesignInfo.calledOnceWithExactly('medic', 'medic-client')).to.be.true;
      expect(getActiveTasks).to.have.been.calledOnce;
      expect(mockViewLib.warmView.args).to.deep.equal([
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
      ]);
      expect(mockNouveauLib.warmNouveau).to.have.been.calledOnceWithExactly('medic', '_design/medic-client');
      expect(warmNouveauInner).to.not.have.been.called;
    }));

    it('warms the nouveau indexes for the given design doc', run(function* () {
      const expectedTasks = [
        { type: 'search_indexer', design_document: '_design/medic-client', database: 'shards/aaaaa/medic.123456' },
        { type: 'not-indexer', design_document: '_design/medic', database: 'shards/aaaaa/medic.123456' }
      ];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      const ddoc = {
        _id: '_design/medic-client',
        nouveau: {
          index1: {},
          index2: {}
        },
      };
      mockDesignLib.getCouchDesign.returns(Effect.succeed(ddoc));

      mockDesignInfoLib.getDesignInfo.returns(Effect.succeed(createDesignInfo({
        name: 'test-client', updater_running: false
      })));
      getActiveTasks.returns(Effect.succeed([]));

      const stream = yield* WarmViewsService.warmDesign('medic', 'medic-client');
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('indexer', 'search_indexer')).to.be.true;
      expect(mockActiveTasksLib.filterStreamByDesign.calledOnceWithExactly('medic', '_design/medic-client')).to.be.true;
      expect(mockDesignLib.getViewNames).to.not.have.been.called;
      expect(mockDesignLib.getCouchDesign).to.have.been.calledOnceWithExactly('medic', 'medic-client');
      expect(mockDesignInfoLib.getDesignInfo.calledOnceWithExactly('medic', 'medic-client')).to.be.true;
      expect(getActiveTasks).to.have.been.calledOnce;
      expect(mockViewLib.warmView).to.not.have.been.called;
      expect(mockNouveauLib.warmNouveau).to.have.been.calledOnceWithExactly('medic', '_design/medic-client');
      expect(warmNouveauInner.args).to.deep.equal(Array.map(['index1', 'index2'], Array.make));
    }));

    it('streams until the views are warm', run(function* () {
      const expectedTasks = [ { type: 'indexer', design_document: '_design/medic-client', }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.make(expectedTasks, expectedTasks, expectedTasks));
      const ddoc = {
        _id: '_design/medic-client',
        views: {
          view1: {},
          view2: {}
        },
      };
      mockDesignLib.getCouchDesign.returns(Effect.succeed(ddoc));
      mockDesignInfoLib.getDesignInfo
        .onFirstCall()
        .returns(Effect.succeed(createDesignInfo({
          name: 'test-client', updater_running: true
        })));
      mockDesignInfoLib.getDesignInfo
        .onSecondCall()
        .returns(Effect.succeed(createDesignInfo({
          name: 'test-client', updater_running: false
        })));
      getActiveTasks.returns(Effect.succeed([]));
      // First warming attempt times out.
      mockViewLib.warmView.onCall(0).returns(Effect.fail(new TimeoutException()));
      mockViewLib.warmView.onCall(1).returns(Effect.fail(new TimeoutException()));
      mockViewLib.warmView.onCall(2).returns(Effect.void);
      mockViewLib.warmView.onCall(3).returns(Effect.void);

      const stream = yield* WarmViewsService.warmDesign('medic', 'medic-client');
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      // Third set of tasks should not be streamed since the design is now warm.
      expect(tasks).to.deep.equal([expectedTasks, expectedTasks]);
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('indexer', 'search_indexer')).to.be.true;
      expect(mockDesignLib.getViewNames).to.not.have.been.called;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-client'],
      ]);
      expect(getActiveTasks).to.have.been.calledTwice;
      expect(mockViewLib.warmView.args).to.deep.equal([
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
      ]);
      expect(mockNouveauLib.warmNouveau).to.have.been.calledOnceWithExactly('medic', '_design/medic-client');
      expect(warmNouveauInner).to.not.have.been.called;
    }));


    it('streams until the nouveau indexes are warm', run(function* () {
      const expectedTasks = [ { type: 'indexer', design_document: '_design/medic-client', }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.make(expectedTasks, expectedTasks, expectedTasks));
      const ddoc = {
        _id: '_design/medic-client',
        nouveau: {
          index1: {},
          index2: {}
        },
      };
      mockDesignLib.getCouchDesign.returns(Effect.succeed(ddoc));
      mockDesignInfoLib.getDesignInfo
        .returns(Effect.succeed(createDesignInfo({
          name: 'test-client', updater_running: false
        })));
      getActiveTasks.onFirstCall().returns(Effect.succeed([{
        type: 'search_indexer',
        design_document: '_design/medic-client',
        database: 'shards/aaaaa/medic.123456',
      }]));
      // Should all be filtered out
      getActiveTasks.onSecondCall().returns(Effect.succeed([
        {
          type: 'indexer',
          design_document: '_design/medic-client',
          database: 'shards/aaaaa/medic.123456',
        },
        {
          type: 'search_indexer',
          design_document: '_design/medic',
          database: 'shards/aaaaa/medic.123456',
        },
        {
          type: 'search_indexer',
          design_document: '_design/medic-client',
          database: 'shards/aaaaa/not-medic.123456',
        }
      ]));

      const stream = yield* WarmViewsService.warmDesign('medic', 'medic-client');
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      // Third set of tasks should not be streamed since the design is now warm.
      expect(tasks).to.deep.equal([expectedTasks, expectedTasks]);
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('indexer', 'search_indexer')).to.be.true;
      expect(mockDesignLib.getViewNames).to.not.have.been.called;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-client'],
      ]);
      expect(getActiveTasks).to.have.been.calledTwice;
      expect(mockViewLib.warmView).to.not.have.been.called;
      expect(mockNouveauLib.warmNouveau).to.have.been.calledOnceWithExactly('medic', '_design/medic-client');
      expect(warmNouveauInner.args).to.deep.equal(Array.map(['index1', 'index2'], Array.make));
    }));
  });
});
