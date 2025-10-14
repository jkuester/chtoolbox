import { describe, it } from 'mocha';
import { Effect, Either, Layer, pipe } from 'effect';
import { expect } from 'chai';
import sinon, { type SinonStub } from 'sinon';
import * as ChtClientSvc from '../../src/services/cht-client.ts';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import { DEFAULT_CHT_URL_AUTH, genWithDefaultConfig, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const REQUEST = HttpClientRequest.get('/test');
const FAKE_HTTP_RESPONSE = { fake: 'response' } as const;
const fakeHttpClient = { execute: sandbox.stub() };
const filterStatusOk = sandbox.stub();
const mapRequest = sandbox.stub();
const mockHttpRequest = { prependUrl: sandbox.stub() };

const { ChtClientService } = await esmock<typeof ChtClientSvc>('../../src/services/cht-client.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '@effect/platform/HttpClient': { filterStatusOk, mapRequest },
});

const run = pipe(
  ChtClientService.Default,
  Layer.provide(Layer.succeed(HttpClient.HttpClient, fakeHttpClient as unknown as HttpClient.HttpClient)),
  genWithDefaultConfig,
);

describe('CHT Client Service', () => {
  let innerMapRequest: SinonStub;

  beforeEach(() => {
    mockHttpRequest.prependUrl.returnsArg(0);
    innerMapRequest = sinon.stub().returns(fakeHttpClient);
    mapRequest.returns(innerMapRequest);
    filterStatusOk.returns(fakeHttpClient);
  });

  afterEach(() => {
    expect(mockHttpRequest.prependUrl).to.have.been.calledOnceWithExactly(DEFAULT_CHT_URL_AUTH);
    expect(mapRequest).to.have.been.calledOnceWithExactly(DEFAULT_CHT_URL_AUTH);
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
