import { afterEach, describe, it } from 'mocha';
import { Chunk, Effect, Layer, Option, Schedule, Stream, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import {
  CouchActiveTasksService,
  filterStreamByType,
  getDbName,
  getDesignName,
  getDisplayDictByPid,
  getPid,
  getProgressPct
} from '../../../src/services/couch/active-tasks';
import { createActiveTask } from '../../utils/data-models';
import * as schedule from 'effect/Schedule';

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

describe('Couch Active Tasks Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchActiveTasksService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchActiveTasksService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, {
        request: couchRequest,
      } as unknown as CouchService)),
    ));
  };

  describe('get', () => {
    it('returns active tasks ordered by started_on', run(Effect.gen(function* () {
      requestGet.returns(FAKE_CLIENT_REQUEST);
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed([TASK_LATER, TASK_ALL_DATA, TASK_MIN_DATA]),
      }));

      const service = yield* CouchActiveTasksService;
      const tasks = yield* service.get();

      expect(tasks).to.deep.equal([TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER]);
      expect(requestGet.calledOnceWithExactly('/_active_tasks')).to.be.true;
      expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    })));

    it('returns an empty array when there are no active tasks', run(Effect.gen(function* () {
      requestGet.returns(FAKE_CLIENT_REQUEST);
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed([]),
      }));

      const service = yield* CouchActiveTasksService;
      const tasks = yield* service.get();

      expect(tasks).to.deep.equal([]);
      expect(requestGet.calledOnceWithExactly('/_active_tasks')).to.be.true;
      expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    })));
  });

  describe('stream', () => {
    let scheduleSpaced: SinonStub;

    beforeEach(() => {
      scheduleSpaced = sinon.stub(schedule, 'spaced');
    });

    it('returns a stream of active tasks with the given interval', run(Effect.gen(function* () {
      requestGet.returns(FAKE_CLIENT_REQUEST);
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed([TASK_LATER, TASK_ALL_DATA, TASK_MIN_DATA]),
      }));
      scheduleSpaced.returns(Schedule.recurs(2));
      const expectedInterval = 5000;

      const service = yield* CouchActiveTasksService;
      const taskStream = service.stream(expectedInterval);

      expect(scheduleSpaced.calledOnceWithExactly(expectedInterval)).to.be.true;
      expect(requestGet.notCalled).to.be.true;

      const streamedTasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(streamedTasks).to.deep.equal([
        [TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER],
        [TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER],
        [TASK_MIN_DATA, TASK_ALL_DATA, TASK_LATER],
      ]);
      expect(requestGet.callCount).to.equal(3);
      expect(requestGet.args).to.deep.equal([['/_active_tasks'], ['/_active_tasks'], ['/_active_tasks']]);
      expect(couchRequest.args).to.deep.equal([[FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST]]);
    })));

    it('returns a stream of empty array when there are no tasks', run(Effect.gen(function* () {
      requestGet.returns(FAKE_CLIENT_REQUEST);
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed([]),
      }));
      scheduleSpaced.returns(Schedule.once);

      const service = yield* CouchActiveTasksService;
      const taskStream = service.stream();

      expect(scheduleSpaced.calledOnceWithExactly(1000)).to.be.true;
      expect(requestGet.notCalled).to.be.true;

      const streamedTasks = Chunk.toReadonlyArray(yield* Stream.runCollect(taskStream));

      expect(streamedTasks).to.deep.equal([[], []]);
      expect(requestGet.callCount).to.equal(2);
      expect(requestGet.args).to.deep.equal([['/_active_tasks'], ['/_active_tasks']]);
      expect(couchRequest.args).to.deep.equal([[FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST]]);
    })));
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

  it('filterStreamByType', run(Effect.gen(function* () {
    const task1 = createActiveTask({ type: 'type1' });
    const task2 = createActiveTask({ type: 'type2' });

    const taskStream = Stream.succeed([TASK_ALL_DATA, task1, task2, TASK_MIN_DATA]);
    const filteredStream = filterStreamByType('type1', 'type2')(taskStream);
    const tasks = Chunk.toReadonlyArray(yield* Stream.runCollect(filteredStream));

    expect(tasks).to.deep.equal([[task1, task2]]);
  })));
});
