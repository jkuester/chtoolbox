import { describe, it } from 'mocha';
import { Effect, Either, Layer, Redacted } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import * as ChtClientSvc from '../../src/services/cht-client.js';
import { HttpClientRequest } from '@effect/platform';
import { EnvironmentService } from '../../src/services/environment.js';
import { NodeHttpClient } from '@effect/platform-node';
import { genWithLayer, sandbox } from '../utils/base.js';
import esmock from 'esmock';

const mockHttpClient = {
  filterStatusOk: sandbox.stub(),
  mapRequest: sandbox.stub(),
};
const mockHttpRequest = { prependUrl: sandbox.stub() };
const environmentGet = sandbox.stub();

const { ChtClientService } = await esmock<typeof ChtClientSvc>('../../src/services/cht-client.js', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '@effect/platform/HttpClient': mockHttpClient
});
const run = ChtClientService.Default.pipe(
  Layer.provide(Layer.succeed(EnvironmentService, { get: environmentGet } as unknown as EnvironmentService)),
  Layer.provide(NodeHttpClient.layer),
  genWithLayer,
);

describe('CHT Client Service', () => {
  it('prepends the url to the request', run(function* () {
    const url = 'http://localhost:5984';
    const env = Redacted.make(url).pipe(url => ({ url }));
    environmentGet.returns(Effect.succeed(env));
    const fakeHttpClientEffect = Effect.succeed({ hello: 'world' });
    mockHttpClient.filterStatusOk.returns(fakeHttpClientEffect);
    const fakeHttpRequest = { fake: 'request' };
    const innerPrependUrl = sinon.stub().returns(fakeHttpRequest);
    mockHttpRequest.prependUrl.returns(innerPrependUrl);
    const fakeHttpResponse = { fake: 'response' };
    const execute = sinon.stub().returns(Effect.succeed(fakeHttpResponse));
    const innerMapRequest = sinon.stub().returns({ execute });
    mockHttpClient.mapRequest.returns(innerMapRequest);
    const request = HttpClientRequest.get('/test');

    const response = yield* ChtClientService.request(request);

    expect(response).to.deep.equal(fakeHttpResponse);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
    expect(mockHttpRequest.prependUrl.calledOnceWithExactly(url)).to.be.true;
    expect(innerPrependUrl.notCalled).to.be.true;
    expect(mockHttpClient.mapRequest.calledOnceWithExactly(innerPrependUrl)).to.be.true;
    expect(innerMapRequest.calledOnceWithExactly(fakeHttpClientEffect)).to.be.true;
    expect(execute.calledOnceWithExactly(request)).to.be.true;
  }));

  it('returns error when request fails', run(function* () {
    const url = 'http://localhost:5984';
    const env = Redacted.make(url).pipe(url => ({ url }));
    environmentGet.returns(Effect.succeed(env));
    const fakeHttpClientEffect = Effect.succeed({ hello: 'world' });
    mockHttpClient.filterStatusOk.returns(fakeHttpClientEffect);
    const fakeHttpRequest = { fake: 'request' };
    const innerPrependUrl = sinon.stub().returns(fakeHttpRequest);
    mockHttpRequest.prependUrl.returns(innerPrependUrl);
    const expectedError = new Error('Request failed');
    const execute = sinon.stub().returns(Effect.fail(expectedError));
    const innerMapRequest = sinon.stub().returns({ execute });
    mockHttpClient.mapRequest.returns(innerMapRequest);
    const request = HttpClientRequest.get('/test');

    const either = yield* Effect.either(ChtClientService.request(request));

    if (Either.isLeft(either)) {
      expect(either.left).to.equal(expectedError);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.prependUrl.calledOnceWithExactly(url)).to.be.true;
      expect(innerPrependUrl.notCalled).to.be.true;
      expect(mockHttpClient.mapRequest.calledOnceWithExactly(innerPrependUrl)).to.be.true;
      expect(innerMapRequest.calledOnceWithExactly(fakeHttpClientEffect)).to.be.true;
      expect(execute.calledOnceWithExactly(request)).to.be.true;
    } else {
      expect.fail('Expected error to be thrown.');
    }
  }));
});
