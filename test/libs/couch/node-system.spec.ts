import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.js';
import { createNodeSystem } from '../../utils/data-models.js';
import * as NodeSystemLibs from '../../../src/libs/couch/node-system.js';
import { genWithLayer, sandbox } from '../../utils/base.js';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getCouchNodeSystem } = await esmock<typeof NodeSystemLibs>('../../../src/libs/couch/node-system.js', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Node System libs', () => {
  it('gets node system data', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const expectedNodeSystem = createNodeSystem({
      processes_used: 324116345634,
      binary: 34,
    });
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed(expectedNodeSystem),
    }));

    const nodeSystem = yield* getCouchNodeSystem();

    expect(nodeSystem).to.deep.equal(expectedNodeSystem);
    expect(mockHttpRequest.get.calledOnceWithExactly('/_node/_local/_system')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
