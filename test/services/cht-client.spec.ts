import { describe, it } from 'mocha';
import { Effect, Either, Layer, pipe } from 'effect';
import { expect } from 'chai';
import sinon, { type SinonStub } from 'sinon';
import * as ChtClientSvc from '../../src/services/cht-client.ts';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import {
  DEFAULT_CHT_PASSWORD,
  DEFAULT_CHT_URL,
  DEFAULT_CHT_USERNAME,
  genWithDefaultConfig,
  sandbox
} from '../utils/base.ts';
import esmock from 'esmock';

const REQUEST = HttpClientRequest.get('/test');
const FAKE_HTTP_RESPONSE = { fake: 'response' } as const;
const fakeHttpClient = { execute: sandbox.stub() };
const filterStatusOk = sandbox.stub();
const mapRequest = sandbox.stub();
const mockHttpRequest = {
  prependUrl: sandbox.stub(),
  setHeader: sandbox.stub(),
};

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
    mockHttpRequest.setHeader.returnsArg(0);
    innerMapRequest = sinon.stub().returns(fakeHttpClient);
    mapRequest.returns(innerMapRequest);
    filterStatusOk.returns(fakeHttpClient);
  });

  afterEach(() => {
    expect(mockHttpRequest.prependUrl).to.have.been.calledOnceWithExactly(DEFAULT_CHT_URL);
    const encodedAuth = Buffer
      .from(`${DEFAULT_CHT_USERNAME}:${DEFAULT_CHT_PASSWORD}`)
      .toString('base64');
    const authHeader = `Basic ${encodedAuth}`;
    expect(mockHttpRequest.setHeader).to.have.been.calledOnceWithExactly('Authorization', authHeader);
    expect(mapRequest.args).to.deep.equal([[DEFAULT_CHT_URL], ['Authorization']]);
    expect(innerMapRequest.args).to.deep.equal([[fakeHttpClient], [fakeHttpClient]]);
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
