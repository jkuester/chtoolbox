import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchActiveTasksService, CouchActiveTasksServiceLive } from '../../../src/services/couch/active-tasks';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const TASK_WITH_DESIGN = {
  database: 'shards/aaaaaaa8-bffffffc/medic.1727212895',
  pid: '<0.6320.88>',
  progress: 52,
  started_on: 1727298631,
  type: 'view_compaction',
  design_document: '_design/medic-client',
};
const TASK_WITHOUT_DESIGN = {
  database: 'shards/23452323-12111/medic-sentinel.123123123',
  pid: '<0.777.455>',
  progress: 1,
  started_on: 172720000,
  type: 'indexer',
  design_document: undefined
};

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
      json: Effect.succeed([TASK_WITH_DESIGN, TASK_WITHOUT_DESIGN]),
    }));

    const service = yield* CouchActiveTasksService;
    const tasks = yield* service.get();

    expect(tasks).to.deep.equal([TASK_WITH_DESIGN, TASK_WITHOUT_DESIGN]);
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
