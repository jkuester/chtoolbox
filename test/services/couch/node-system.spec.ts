import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { createNodeSystem } from '../../utils/data-models';
import { CouchNodeSystemService } from '../../../src/services/couch/node-system';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch Node System Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test: Effect.Effect<unknown, unknown, CouchNodeSystemService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchNodeSystemService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(ChtClientService, {
        request: couchRequest,
      } as unknown as ChtClientService)),
    ));
  };

  it('gets node system data', run(Effect.gen(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const expectedNodeSystem = createNodeSystem({
      processes_used: 324116345634,
      binary: 34,
    });
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(expectedNodeSystem),
    }));

    const nodeSystem = yield* CouchNodeSystemService.get();

    expect(nodeSystem).to.deep.equal(expectedNodeSystem);
    expect(requestGet.calledOnceWithExactly('/_node/_local/_system')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));
});
