import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { createNodeSystem } from '../../utils/data-models';
import { getCouchNodeSystem } from '../../../src/services/couch/node-system';
import { genWithLayer, sandbox } from '../../utils/base';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch Node System Service', () => {
  let requestGet: SinonStub;

  beforeEach(() => {
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  it('gets node system data', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const expectedNodeSystem = createNodeSystem({
      processes_used: 324116345634,
      binary: 34,
    });
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(expectedNodeSystem),
    }));

    const nodeSystem = yield* getCouchNodeSystem();

    expect(nodeSystem).to.deep.equal(expectedNodeSystem);
    expect(requestGet.calledOnceWithExactly('/_node/_local/_system')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
