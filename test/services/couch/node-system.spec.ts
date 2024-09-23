import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { createNodeSystem } from '../../utils/data-models';
import { CouchNodeSystemService, CouchNodeSystemServiceLive } from '../../../src/services/couch/node-system';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch Node System Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchNodeSystemService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchNodeSystemServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, CouchService.of({
        request: couchRequest,
      }))),
    ));
  };

  it('gets node system data', run(Effect.gen(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const expectedNodeSystem = createNodeSystem({
      other: 12352352,
      atom: 235235,
      atom_used: 1453,
      processes: 32232,
      processes_used: 324116345634,
      binary: 34,
      code: 23232,
      ets: 999,
    });
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(expectedNodeSystem),
    }));

    const service = yield* CouchNodeSystemService;
    const nodeSystem = yield* service.get();

    expect(nodeSystem).to.deep.equal(expectedNodeSystem);
    expect(requestGet.calledOnceWithExactly('/_node/_local/_system')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));
});
