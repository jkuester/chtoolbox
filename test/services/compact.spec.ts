import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Stream } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import * as CouchDbsInfo from '../../src/libs/couch/dbs-info';
import * as CouchDesignInfo from '../../src/libs/couch/design-info';
import { CompactService } from '../../src/services/compact';
import * as CouchDesignDocs from '../../src/libs/couch/design-docs';
import * as CouchActiveTasksSvc from '../../src/services/couch/active-tasks';
import { CouchActiveTasksService } from '../../src/services/couch/active-tasks';
import * as CouchCompactService from '../../src/libs/couch/compact';
import * as core from '../../src/libs/core';
import { genWithLayer, sandbox } from '../utils/base';
import { ChtClientService } from '../../src/services/cht-client';

const activeTasksStream = sandbox.stub();

const run = CompactService.Default.pipe(
  Layer.provide(Layer.succeed(CouchActiveTasksService, {
    stream: activeTasksStream,
  } as unknown as CouchActiveTasksService)),
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  genWithLayer,
);

describe('Compact service', () => {
  let designInfoSvcGet: SinonStub;
  let designDocsSvcGetNames: SinonStub;
  let dbsInfoSvcGetDbNames: SinonStub;
  let dbInfoSvcGet: SinonStub;
  let compactSvcCompactDb: SinonStub;
  let compactSvcCompactDesign: SinonStub;
  let filterStreamByType: SinonStub;
  let untilEmptyCount: SinonStub;

  beforeEach(() => {
    designInfoSvcGet = sinon.stub(CouchDesignInfo, 'getDesignInfo');
    designDocsSvcGetNames = sinon.stub(CouchDesignDocs, 'getDesignDocNames');
    dbsInfoSvcGetDbNames = sinon.stub(CouchDbsInfo, 'getDbNames');
    dbInfoSvcGet = sinon.stub(CouchDbsInfo, 'getAllDbsInfo');
    compactSvcCompactDb = sinon.stub(CouchCompactService, 'compactDb');
    compactSvcCompactDesign = sinon.stub(CouchCompactService, 'compactDesign');
    filterStreamByType = sinon
      .stub(CouchActiveTasksSvc, 'filterStreamByType')
      .returns(sinon.stub().returnsArg(0));
    untilEmptyCount = sinon.stub(core, 'untilEmptyCount');
  });

  describe('compactAll', () => {
    it('compacts all databases and views', run(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test']));
      compactSvcCompactDb.returns(Effect.void);
      compactSvcCompactDesign.returns(Effect.void);
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed(['test-client']));
      const expectedTasks = [{ hello: 'world' }];
      activeTasksStream.returns(Stream.succeed(expectedTasks));
      untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      const taskStream = yield* CompactService.compactAll(true);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
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
      expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
      expect(filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));

    it('compacts only databases when no views found', run(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test']));
      compactSvcCompactDb.returns(Effect.void);
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed([]));
      designDocsSvcGetNames.withArgs('test').returns(Effect.succeed([]));
      activeTasksStream.returns(Stream.succeed([]));
      untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      yield* CompactService.compactAll(true);

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic'], ['test']]);
      expect(designInfoSvcGet.notCalled).to.be.true;
      expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
      expect(filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));

    it('compacts nothing if no databases found', run(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed([]));
      activeTasksStream.returns(Stream.succeed([]));
      untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      yield* CompactService.compactAll(true);

      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.notCalled).to.be.true;
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
      expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
      expect(filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));

    it('compacts databases but not designs when indicated', run(function* () {
      dbsInfoSvcGetDbNames.returns(Effect.succeed(['medic', 'test']));
      compactSvcCompactDb.returns(Effect.void);
      const expectedTasks = [{ hello: 'world' }];
      activeTasksStream.returns(Stream.succeed(expectedTasks));
      untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));

      const taskStream = yield* CompactService.compactAll(false);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(dbsInfoSvcGetDbNames.calledOnceWithExactly()).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.args).to.deep.equal([['medic'], ['test']]);
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
      expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
      expect(filterStreamByType.calledOnceWithExactly('database_compaction')).to.be.true;
      expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));
  });

  describe('compactDb', () => {
    it('compacts database but not designs when indicated', run(function* () {
      compactSvcCompactDb.returns(Effect.void);
      const expectedTasks = [{ database: 'shards/aaaaaaa8-bffffffc/medic.1727212895' }];
      activeTasksStream.returns(Stream.succeed(expectedTasks));
      untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));
      const dbName = 'medic';

      const taskStream = yield* CompactService.compactDb(dbName, false);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(dbsInfoSvcGetDbNames.notCalled).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.calledOnceWithExactly(dbName)).to.be.true;
      expect(compactSvcCompactDesign.notCalled).to.be.true;
      expect(designDocsSvcGetNames.notCalled).to.be.true;
      expect(designInfoSvcGet.notCalled).to.be.true;
      expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
      expect(filterStreamByType.calledOnceWithExactly('database_compaction')).to.be.true;
      expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));


    it('compacts database and all its views when indicated', run(function* () {
      compactSvcCompactDb.returns(Effect.void);
      compactSvcCompactDesign.returns(Effect.void);
      designDocsSvcGetNames.withArgs('medic').returns(Effect.succeed(['medic-client', 'medic-sms']));
      const expectedTasks = [{
        database: 'shards/aaaaaaa8-bffffffc/medic.1727212895',
        design_document: '_design/medic-client',
      }];
      activeTasksStream.returns(Stream.succeed(expectedTasks));
      untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));
      const dbName = 'medic';

      const taskStream = yield* CompactService.compactDb(dbName, true);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(tasks).to.deep.equal([expectedTasks]);
      expect(dbsInfoSvcGetDbNames.notCalled).to.be.true;
      expect(dbInfoSvcGet.notCalled).to.be.true;
      expect(compactSvcCompactDb.calledOnceWithExactly(dbName)).to.be.true;
      expect(compactSvcCompactDesign.args).to.deep.equal([
        ['medic', 'medic-client'],
        ['medic', 'medic-sms'],
      ]);
      expect(designDocsSvcGetNames.args).to.deep.equal([['medic']]);
      expect(designInfoSvcGet.notCalled).to.be.true;
      expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
      expect(filterStreamByType.calledOnceWithExactly('database_compaction', 'view_compaction')).to.be.true;
      expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
    }));
  });

  it('compactDesign', run(function* () {
    compactSvcCompactDesign.returns(Effect.void);
    const expectedTasks = [{
      database: 'shards/aaaaaaa8-bffffffc/medic.1727212895',
      design_document: '_design/medic-client',
    }];
    activeTasksStream.returns(Stream.succeed([
      ...expectedTasks,
      {  database: 'shards/no_design/medic.17272234234' }
    ]));
    untilEmptyCount.returns(sinon.stub().returns(Effect.succeed(false)));
    const dbName = 'medic';
    const designName = 'medic-client';

    const service = yield* CompactService;
    const taskStream = yield* service.compactDesign(dbName)(designName);
    const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

    expect(tasks).to.deep.equal([expectedTasks]);
    expect(dbsInfoSvcGetDbNames.notCalled).to.be.true;
    expect(dbInfoSvcGet.notCalled).to.be.true;
    expect(compactSvcCompactDb.notCalled).to.be.true;
    expect(compactSvcCompactDesign.calledOnceWithExactly(dbName, designName)).to.be.true;
    expect(designDocsSvcGetNames.notCalled).to.be.true;
    expect(designInfoSvcGet.notCalled).to.be.true;
    expect(activeTasksStream.calledOnceWithExactly()).to.be.true;
    expect(filterStreamByType.calledOnceWithExactly('view_compaction')).to.be.true;
    expect(untilEmptyCount.calledOnceWithExactly(5)).to.be.true;
  }));
});
