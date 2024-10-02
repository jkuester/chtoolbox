import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchActiveTasksService, CouchActiveTasksServiceLive } from '../../../src/services/couch/active-tasks';
import { createActiveTask } from '../../utils/data-models';

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
      Effect.provide(CouchActiveTasksServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, CouchService.of({
        request: couchRequest,
      }))),
    ));
  };

  it('returns active tasks', run(Effect.gen(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed([TASK_ALL_DATA, TASK_MIN_DATA]),
    }));

    const service = yield* CouchActiveTasksService;
    const tasks = yield* service.get();

    expect(tasks).to.deep.equal([TASK_ALL_DATA, TASK_MIN_DATA]);
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
