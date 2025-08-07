import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Stream } from 'effect';
import sinon from 'sinon';
import { expect } from 'chai';
import * as CompactSvc from '../../src/services/compact.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import esmock from 'esmock';

const mockActiveTasksLib = {
  filterStreamByType: sandbox.stub(),
  streamActiveTasks: sandbox.stub(),
}
const mockDesignInfoLib = { getDesignInfo: sandbox.stub() };
const mockDesignDocsLib = { getDesignDocNames: sandbox.stub() };
const mockDbsInfoLib = {
  getDbNames: sandbox.stub(),
  getAllDbsInfo: sandbox.stub(),
};
const mockCompactLib = {
  compactDb: sandbox.stub(),
  compactDesign: sandbox.stub(),
};
const mockCore = { untilEmptyCount: sandbox.stub() };

const { CompactService } = await esmock<typeof CompactSvc>('../../src/services/compact.ts', {
  '../../src/libs/couch/dbs-info.ts': mockDbsInfoLib,
  '../../src/libs/couch/design-info.ts': mockDesignInfoLib,
  '../../src/libs/couch/design-docs.ts': mockDesignDocsLib,
  '../../src/libs/couch/active-tasks.ts': mockActiveTasksLib,
  '../../src/libs/couch/compact.ts': mockCompactLib,
  '../../src/libs/core.ts': mockCore,
});
const run = CompactService.Default
  .pipe(
    Layer.provideMerge(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
    genWithLayer,
  );

describe('Compact service', () => {

  beforeEach(() => mockActiveTasksLib.filterStreamByType.returns(sinon.stub().returnsArg(0)));

  describe('compactAll', () => {
    it('compacts all databases and views', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed(['medic', 'test']));
      mockCompactLib.compactDb.returns(Effect.void);
      mockCompactLib.compactDesign.returns(Effect.void);
      mockDesignDocsLib.getDesignDocNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      mockDesignDocsLib.getDesignDocNames.withArgs('test').returns(Effect.succeed(['test-client']));
      const expectedTasks = [{ hello: 'world' }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      const taskStream = yield* CompactService.compactAll(true);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
      expect(mockCompactLib.compactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(mockCompactLib.compactDesign.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
        ['test', 'test-client'],
      ]);
      expect(mockDesignDocsLib.getDesignDocNames.args).to.deep.equal([['medic'], ['test']]);
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));

    it('compacts only databases when no views found', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed(['medic', 'test']));
      mockCompactLib.compactDb.returns(Effect.void);
      mockDesignDocsLib.getDesignDocNames.withArgs('medic').returns(Effect.succeed([]));
      mockDesignDocsLib.getDesignDocNames.withArgs('test').returns(Effect.succeed([]));
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed([]));
      mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      yield* CompactService.compactAll(true);

      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
      expect(mockCompactLib.compactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(mockCompactLib.compactDesign.notCalled).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.args).to.deep.equal([['medic'], ['test']]);
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));

    it('compacts nothing if no databases found', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed([]));
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed([]));
      mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      yield* CompactService.compactAll(true);

      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
      expect(mockCompactLib.compactDb.notCalled).to.be.true;
      expect(mockCompactLib.compactDesign.notCalled).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));

    it('compacts databases but not designs when indicated', run(function* () {
      mockDbsInfoLib.getDbNames.returns(Effect.succeed(['medic', 'test']));
      mockCompactLib.compactDb.returns(Effect.void);
      const expectedTasks = [{ hello: 'world' }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      const taskStream = yield* CompactService.compactAll(false);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(mockDbsInfoLib.getDbNames.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
      expect(mockCompactLib.compactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(mockCompactLib.compactDesign.notCalled).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('database_compaction')).to.be.true;
      expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));
  });

  describe('compactDb', () => {
    it('compacts database but not designs when indicated', run(function* () {
      mockCompactLib.compactDb.returns(Effect.void);
      const expectedTasks = [{ database: 'shards/aaaaaaa8-bffffffc/medic.1727212895' }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));
      const dbName = 'medic';

      const taskStream = yield* CompactService.compactDb(dbName, false);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(mockDbsInfoLib.getDbNames.notCalled).to.be.true;
      expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
      expect(mockCompactLib.compactDb.calledOnceWithExactly(dbName)).to.be.true;
      expect(mockCompactLib.compactDesign.notCalled).to.be.true;
      expect(mockDesignDocsLib.getDesignDocNames.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('database_compaction')).to.be.true;
      expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));


    it('compacts database and all its views when indicated', run(function* () {
      mockCompactLib.compactDb.returns(Effect.void);
      mockCompactLib.compactDesign.returns(Effect.void);
      mockDesignDocsLib.getDesignDocNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      const expectedTasks = [{
        database: 'shards/aaaaaaa8-bffffffc/medic.1727212895',
        design_document: '_design/medic-client',
      }];
      mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed(expectedTasks));
      mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));
      const dbName = 'medic';

      const taskStream = yield* CompactService.compactDb(dbName, true);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(mockDbsInfoLib.getDbNames.notCalled).to.be.true;
      expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
      expect(mockCompactLib.compactDb.calledOnceWithExactly(dbName)).to.be.true;
      expect(mockCompactLib.compactDesign.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
      ]);
      expect(mockDesignDocsLib.getDesignDocNames.args).to.deep.equal([['medic']]);
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
      expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));
  });

  it('compactDesign', run(function* () {
    mockCompactLib.compactDesign.returns(Effect.void);
    const expectedTasks = [{
      database: 'shards/aaaaaaa8-bffffffc/medic.1727212895',
      design_document: '_design/medic-client',
    }];
    mockActiveTasksLib.streamActiveTasks.returns(Stream.succeed([
      ...expectedTasks,
      {  database: 'shards/no_design/medic.17272234234' }
    ]));
    mockCore.untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));
    const dbName = 'medic';
    const designName = 'medic-client';

    const service = yield* CompactService;
    const taskStream = yield* service.compactDesign(dbName)(designName);
    const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

    expect(tasks).to.deep.equal([expectedTasks]);
    expect(mockDbsInfoLib.getDbNames.notCalled).to.be.true;
    expect(mockDbsInfoLib.getAllDbsInfo.notCalled).to.be.true;
    expect(mockCompactLib.compactDb.notCalled).to.be.true;
    expect(mockCompactLib.compactDesign.calledOnceWithExactly(dbName, designName)).to.be.true;
    expect(mockDesignDocsLib.getDesignDocNames.notCalled).to.be.true;
    expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
    expect(mockActiveTasksLib.streamActiveTasks.calledOnceWithExactly()).to.be.true;
    expect(mockActiveTasksLib.filterStreamByType.calledOnceWithExactly('view_compaction')).to.be.true;
    expect(mockCore.untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
  }));
});
