import { describe, it } from 'mocha';
import { Effect, Either, Layer, Redacted } from 'effect';
import { expect } from 'chai';
import sinon, { type SinonStub } from 'sinon';
import * as ChtClientSvc from '../../src/services/cht-client.ts';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import { EnvironmentService } from '../../src/services/environment.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const URL = 'http://localhost:5984';
const REQUEST = HttpClientRequest.get('/test');
const FAKE_HTTP_RESPONSE = { fake: 'response' } as const;
const fakeHttpClient = { execute: sandbox.stub() };
const filterStatusOk = sandbox.stub();
const mapRequest = sandbox.stub();
const mockHttpRequest = { prependUrl: sandbox.stub() };
const environmentGet = sandbox.stub();

const { ChtClientService } = await esmock<typeof ChtClientSvc>('../../src/services/cht-client.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '@effect/platform/HttpClient': { filterStatusOk, mapRequest },
});

const run = ChtClientService.Default.pipe(
  Layer.provide(Layer.succeed(EnvironmentService, { get: environmentGet } as unknown as EnvironmentService)),
  Layer.provide(Layer.succeed(HttpClient.HttpClient, fakeHttpClient as unknown as HttpClient.HttpClient)),
  genWithLayer,
);

describe('CHT Client Service', () => {
  let innerMapRequest: SinonStub;

  beforeEach(() => {
    const env = Redacted.make(URL).pipe(url => ({ url }));
    environmentGet.returns(Effect.succeed(env));
    mockHttpRequest.prependUrl.returnsArg(0);
    innerMapRequest = sinon.stub().returns(fakeHttpClient);
    mapRequest.returns(innerMapRequest);
    filterStatusOk.returns(fakeHttpClient);
  });

  afterEach(() => {
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(mockHttpRequest.prependUrl).to.have.been.calledOnceWithExactly(URL);
    expect(mapRequest).to.have.been.calledOnceWithExactly(URL);
    expect(innerMapRequest).to.have.been.calledOnceWithExactly(fakeHttpClient);
    expect(filterStatusOk.calledOnceWithExactly(fakeHttpClient)).to.be.true;
    expect(fakeHttpClient.execute.calledOnceWithExactly(REQUEST)).to.be.true;
  });

  it('prepends the url to the request', run(function* () {
    fakeHttpClient.execute.returns(Effect.succeed(FAKE_HTTP_RESPONSE));

    const response = yield* ChtClientService.request(REQUEST);

    expect(response).to.deep.equal(FAKE_HTTP_RESPONSE);
  }));

  it('returns error when request fails', run(function* () {
    const expectedError = new Error('Request failed');
    fakeHttpClient.execute.returns(Effect.fail(expectedError));

    const either = yield* ChtClientService
      .request(REQUEST)
      .pipe(Effect.either);

    if (Either.isRight(either)) {
      expect.fail('Expected error');
    }

    expect(either.left).to.deep.include(expectedError);
  }));
});
