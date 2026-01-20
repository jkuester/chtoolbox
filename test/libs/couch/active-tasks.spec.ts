import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Option, Schedule, Stream } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as ActiveTasksLib from '../../../src/libs/couch/active-tasks.ts';
import { createActiveTask } from '../../utils/data-models.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const TASK_ALL_DATA = createActiveTask({
  database: 'shards/aaaaaaa8-bffffffc/medic.1727212895',
  design_document: '_design/medic-client',
  doc_id: '123123123',
  docs_written: 110,
  pid: '<0.6320.88>',
  progress: 52,
  started_on: 1727298631,
  type: 'view_compaction',
});
const TASK_LATER = createActiveTask({
  started_on: 1727298632,
});
const TASK_MIN_DATA = createActiveTask();

const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };
const mockSchedule = { spaced: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const {
  filterStreamByType,
  activeTasksEffect,
  getDbName,
  getDesignName,
  getDisplayDictByPid,
  getPid,
  getProgressPct,
  streamActiveTasks,
  taskHasType,
  filterStreamByDb,
  filterStreamByDesign,
  taskHasDesign
} = await esmock<typeof ActiveTasksLib>('../../../src/libs/couch/active-tasks.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  'effect': { Schedule: mockSchedule },
});

describe('Couch Active Tasks Service', () => {
  describe('activeTasksEffect', () => {
    it('returns active tasks ordered by started_on', run(function* () {
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed([TASK_LATER, TASK_ALL_DATA, TASK_MIN_DATA]),
      }));

      const tasks = yield* activeTasksEffect;

      expect(tasks).to.deep.equal([TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER]);
      expect(mockHttpRequest.get.calledOnceWithExactly('/_active_tasks')).to.be.true;
      expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    }));

    it('returns an empty array when there are no active tasks', run(function* () {
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed([]),
      }));

      const tasks = yield* activeTasksEffect;

      expect(tasks).to.deep.equal([]);
      expect(mockHttpRequest.get.calledOnceWithExactly('/_active_tasks')).to.be.true;
      expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    }));
  });

  describe('stream', () => {
    it('returns a stream of active tasks with the given interval', run(function* () {
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed([TASK_LATER, TASK_ALL_DATA, TASK_MIN_DATA]),
      }));
      mockSchedule.spaced.returns(Schedule.recurs(2));
      const expectedInterval = 5000;

      const taskStream = streamActiveTasks(expectedInterval);

      expect(mockSchedule.spaced.calledOnceWithExactly(expectedInterval)).to.be.true;
      expect(mockHttpRequest.get.notCalled).to.be.true;

      const streamedTasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(streamedTasks).to.deep.equal([
        [TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER],
        [TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER],
        [TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER],
      ]);
      expect(mockHttpRequest.get.callCount).to.equal(3);
      expect(mockHttpRequest.get.args).to.deep.equal([['/_active_tasks'], ['/_active_tasks'], ['/_active_tasks']]);
      expect(mockChtClient.request.args).to.deep.equal(
        [[FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST]]
      );
    }));

    it('returns a stream of empty array when there are no tasks', run(function* () {
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed([]),
      }));
      mockSchedule.spaced.returns(Schedule.once);

      const taskStream = streamActiveTasks();

      expect(mockSchedule.spaced.calledOnceWithExactly(1000)).to.be.true;
      expect(mockHttpRequest.get.notCalled).to.be.true;

      const streamedTasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));


      expect(streamedTasks).to.deep.equal([[], []]);
      expect(mockHttpRequest.get.callCount).to.equal(2);
      expect(mockHttpRequest.get.args).to.deep.equal([['/_active_tasks'], ['/_active_tasks']]);
      expect(mockChtClient.request.args).to.deep.equal([[FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST]]);
    }));
  });

  describe('getDesignName', () => {
    it('returns option with the design name from the task', () => {
      const designName = Option.getOrThrow(getDesignName(TASK_ALL_DATA));
      expect(designName).to.equal('medic-client');
    });

    [
      TASK_MIN_DATA,
      createActiveTask({ design_document: 'medic-client' }),
      createActiveTask({ design_document: 'design/medic-client' }),
      createActiveTask({ design_document: '_design medic-client' }),
    ].forEach(task => {
      it('returns option with none when the task does not have a valid design name', () => {
        const designNameOpt = getDesignName(task);
        expect(Option.isNone(designNameOpt)).to.be.true;
      });
    });
  });

  describe('getDbName', () => {
    it('returns the database name from the task', () => {
      const dbName = getDbName(TASK_ALL_DATA);
      expect(dbName).to.equal('medic');
    });

    [
      TASK_MIN_DATA,
      createActiveTask({ database: 'aaaaaaa8-bffffffc/medic.1727212895' }),
      createActiveTask({ database: 'shards/aaaaaaa8-bffffffc/medic' }),
      createActiveTask({ database: 'medic' }),
    ].forEach(task => {
      it('throws an error when the task does not have a valid database name', () => {
        expect(() => getDbName(task)).to.throw('getOrThrow called on a None');
      });
    });
  });

  it('getPid', () => {
    const pid = getPid(TASK_ALL_DATA);
    expect(pid).to.equal('0.6320.88');
  });

  describe('getProgressPct', () => {
    it('returns the progress percentage from the task', () => {
      const progressPct = getProgressPct(TASK_ALL_DATA);
      expect(progressPct).to.equal('52%');
    });

    it('returns an empty string when the task does not have progress', () => {
      const progressPct = getProgressPct(TASK_MIN_DATA);
      expect(progressPct).to.equal('');
    });
  });

  it('getDisplayDictByPid', () => {
    const tasks = [
      { pid: '1', name: 'first' },
      { pid: '2', name: 'second' },
    ];

    const dict = getDisplayDictByPid(tasks);

    expect(dict).to.deep.equal({
      '1': { name: 'first' },
      '2': { name: 'second' },
    });
  });

  describe('taskHasType', () => {
    it('returns true when task type matches one of the provided types', () => {
      const task = createActiveTask({ type: 'view_compaction' });
      expect(taskHasType('view_compaction', 'indexer')(task)).to.be.true;
    });

    it('returns false when task type does not match any of the provided types', () => {
      const task = createActiveTask({ type: 'view_compaction' });
      expect(taskHasType('indexer', 'other')(task)).to.be.false;
    });
  });

  describe('filterStreamByType', () => {
    it('filters tasks by type', run(function* () {
      const task1 = createActiveTask({ type: 'type1' });
      const task2 = createActiveTask({ type: 'type2' });
      const task3 = createActiveTask({ type: 'type3' });

      const taskStream = Stream.succeed([TASK_ALL_DATA, task1, task2, task3, TASK_MIN_DATA]);
      const filteredStream = filterStreamByType('type1', 'type2')(taskStream);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(filteredStream));

      expect(tasks).to.deep.equal([[task1, task2]]);
    }));
  });

  describe('filterStreamByDb', () => {
    it('filters tasks by database', run(function* () {
      const task1 = createActiveTask({ database: 'shards/aaaaa/medic.123456' });
      const task2 = createActiveTask({ database: 'shards/bbbbb/medic.789012' });
      const task3 = createActiveTask({ database: 'shards/cccccc/other.345678' });

      const taskStream = Stream.succeed([TASK_ALL_DATA, task1, task2, task3]);
      const filteredStream = filterStreamByDb('medic')(taskStream);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(filteredStream));

      expect(tasks).to.deep.equal([[TASK_ALL_DATA, task1, task2]]);
    }));
  });

  describe('taskHasDesign', () => {
    it('returns true when task matches the database name and design id', () => {
      const task = createActiveTask({
        database: 'shards/aaaaa/medic.123456',
        design_document: '_design/test-design'
      });
      expect(taskHasDesign('medic', '_design/test-design')(task)).to.be.true;
    });

    it('returns false when task does not match the database name', () => {
      const task = createActiveTask({
        database: 'shards/aaaaa/other.123456',
        design_document: '_design/test-design'
      });
      expect(taskHasDesign('medic', '_design/test-design')(task)).to.be.false;
    });

    it('returns false when task does not match the design id', () => {
      const task = createActiveTask({
        database: 'shards/aaaaa/medic.123456',
        design_document: '_design/other-design'
      });
      expect(taskHasDesign('medic', '_design/test-design')(task)).to.be.false;
    });
  });

  describe('filterStreamByDesign', () => {
    it('filters tasks by database name and design id', run(function* () {
      const task1 = createActiveTask({
        database: 'shards/aaaaa/medic.123456',
        design_document: '_design/test-design'
      });
      const task2 = createActiveTask({
        database: 'shards/bbbbb/medic.789012',
        design_document: '_design/test-design'
      });
      const task3 = createActiveTask({
        database: 'shards/cccccc/medic.345678',
        design_document: '_design/other-design'
      });

      const taskStream = Stream.succeed([TASK_ALL_DATA, task1, task2, task3]);
      const filteredStream = filterStreamByDesign('medic', '_design/test-design')(taskStream);
      const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(filteredStream));

      expect(tasks).to.deep.equal([[task1, task2]]);
    }));
  });
});
