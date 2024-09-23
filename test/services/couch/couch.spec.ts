import { describe, it } from 'mocha';
import { Config, Effect, Layer, Redacted, Ref, Scope, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService, CouchServiceLive } from '../../../src/services/couch/couch';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import { EnvironmentService } from '../../../src/services/environment';
import { NodeHttpClient } from '@effect/platform-node';

describe('Couch Service', () => {
  let environmentGet: SinonStub;
  let filterStatusOkay: SinonStub;
  let prependUrl: SinonStub;
  let mapRequest: SinonStub;

  beforeEach(() => {
    environmentGet = sinon.stub();
    filterStatusOkay = sinon.stub(HttpClient, 'filterStatusOk');
    prependUrl = sinon.stub(HttpClientRequest, 'prependUrl');
    mapRequest = sinon.stub(HttpClient, 'mapRequest');
  });

  afterEach(() => sinon.restore());

  const run = (test: Effect.Effect<unknown, unknown, CouchService | Scope.Scope>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(EnvironmentService, EnvironmentService.of({
        get: environmentGet,
      }))),
      Effect.provide(NodeHttpClient.layer),
      Effect.scoped,
    ));
  };

  it('prepends the url to the request', run(Effect.gen(function* () {
    const url = 'http://localhost:5984';
    const env = yield* Redacted.make(url).pipe(
      Config.succeed,
      Ref.make,
      Effect.map(url => ({ url }))
    );
    environmentGet.returns(env);
    const fakeHttpClientEffect = Effect.succeed({ hello: 'world' });
    filterStatusOkay.returns(fakeHttpClientEffect);
    const fakeHttpRequest = { fake: 'request' };
    const innerPrependUrl = sinon.stub().returns(fakeHttpRequest);
    prependUrl.returns(innerPrependUrl);
    const fakeHttpResponse = { fake: 'response' };
    const client = sinon.stub().returns(Effect.succeed(fakeHttpResponse));
    const innerMapRequest = sinon.stub().returns(client);
    mapRequest.returns(innerMapRequest);
    const request = HttpClientRequest.get('/test');

    const service = yield* CouchService;
    const response = yield* service.request(request);

    expect(response).to.deep.equal(fakeHttpResponse);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(filterStatusOkay.calledOnce).to.be.true;
    expect(prependUrl.calledOnceWithExactly(url)).to.be.true;
    expect(innerPrependUrl.notCalled).to.be.true;
    expect(mapRequest.calledOnceWithExactly(innerPrependUrl)).to.be.true;
    expect(innerMapRequest.calledOnceWithExactly(fakeHttpClientEffect)).to.be.true;
    expect(client.calledOnceWithExactly(request)).to.be.true;
  })));
});
