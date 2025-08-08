import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Stream } from 'effect';
import { expect } from 'chai';
import { createDesignInfo } from '../utils/data-models.ts';
import * as WarmViewsSvc from '../../src/services/warm-views.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import esmock from 'esmock';
import sinon from 'sinon';
import { TimeoutException } from 'effect/Cause';

const mockViewLib = { warmView: sandbox.stub() };
const mockDesignInfoLib = { getDesignInfo: sandbox.stub() };
const mockDesignDocsLib = { getDesignDocNames: sandbox.stub() };
const mockDesignLib = { getViewNames: sandbox.stub() };
const mockDbsInfoLib = { getDbNames: sandbox.stub() };
const mockActiveTasksLib = {
  filterStreamByType: sandbox.stub(),
  streamActiveTasks: sandbox.stub(),
};

const { WarmViewsService } = await esmock<typeof WarmViewsSvc>('../../src/services/warm-views.ts', {
  '../../src/libs/couch/active-tasks.ts': mockActiveTasksLib,
  '../../src/libs/couch/dbs-info.ts': mockDbsInfoLib,
  '../../src/libs/couch/design-info.ts': mockDesignInfoLib,
  '../../src/libs/couch/design-docs.ts': mockDesignDocsLib,
  '../../src/libs/couch/design.ts': mockDesignLib,
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
    beforeEach(() => mockActiveTasksLib.filterStreamByType.returns(sinon.stub().returnsArg(0)));

    it('warms the views for the given design doc', run(function* () {
      const expectedTasks = [
        { type: 'indexer', design_document: '_design/medic-client', },
        { type: 'not-indexer', design_document: '_design/medic', }
      ];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      mockDesignLib.getViewNames.returns(Effect.succeed(['view1', 'view2']));
      mockDesignInfoLib.getDesignInfo.returns(Effect.succeed(createDesignInfo({
        name: 'test-client', updater_running: false
      })));
      mockViewLib.warmView.returns(Effect.void);

      const stream = yield* WarmViewsService.warmDesign('medic', 'medic-client');
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(tasks).to.deep.equal([[expectedTasks[0]]]);
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('indexer')).to.be.true;
      expect(mockDesignLib.getViewNames.calledOnceWithExactly('medic', 'medic-client')).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.calledOnceWithExactly('medic', 'medic-client')).to.be.true;
      expect(mockViewLib.warmView.args).to.deep.equal([
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
      ]);
    }));

    it('streams until the views are warm', run(function* () {
      const expectedTasks = [ { type: 'indexer', design_document: '_design/medic-client', }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.make(expectedTasks, expectedTasks, expectedTasks));
      mockDesignLib.getViewNames.returns(Effect.succeed(['view1', 'view2']));
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
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('indexer')).to.be.true;
      expect(mockDesignLib.getViewNames.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-client'],
      ]);
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-client'],
      ]);
      expect(mockViewLib.warmView.args).to.deep.equal([
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
        ['medic', 'medic-client', 'view1'],
        ['medic', 'medic-client', 'view2'],
      ]);
    }));
  });
});
