import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { createDesignInfo } from '../utils/data-models.js';
import * as WarmViewsSvc from '../../src/services/warm-views.js';
import { genWithLayer, sandbox } from '../utils/base.js';
import { ChtClientService } from '../../src/services/cht-client.js';
import esmock from 'esmock';

const mockViewLib = { warmView: sandbox.stub() };
const mockDesignInfoLib = { getDesignInfo: sandbox.stub() };
const mockDesignDocsLib = { getDesignDocNames: sandbox.stub() };
const mockDesignLib = { getViewNames: sandbox.stub() };
const mockDbsInfoLib = { getDbNames: sandbox.stub() };

const { WarmViewsService } = await esmock<typeof WarmViewsSvc>('../../src/services/warm-views.js', {
  '../../src/libs/couch/dbs-info.js': mockDbsInfoLib,
  '../../src/libs/couch/design-info.js': mockDesignInfoLib,
  '../../src/libs/couch/design-docs.js': mockDesignDocsLib,
  '../../src/libs/couch/design.js': mockDesignLib,
  '../../src/libs/couch/view.js': mockViewLib,
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
      mockDesignDocsLib.getDesignDocNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms', 'medic']));
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
      mockDesignDocsLib.getDesignDocNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms', 'medic']));
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
});
