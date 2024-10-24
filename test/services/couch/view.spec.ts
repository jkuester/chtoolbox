import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonSpy, SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { CouchViewService } from '../../../src/services/couch/view';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch View Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonSpy;
  let requestSetUrlParam: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.spy(HttpClientRequest, 'get');
    requestSetUrlParam = sinon.stub(HttpClientRequest, 'setUrlParam');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchViewService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchViewService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(ChtClientService, {
        request: couchRequest,
      } as unknown as ChtClientService)),
    ));
  };

  it('warms given database view', run(Effect.gen(function* () {
    const dbName = 'test-db';
    const designName = 'test-design';
    const viewName = 'test-view';
    requestSetUrlParam.returns(sinon.stub().returns(FAKE_CLIENT_REQUEST));
    couchRequest.returns(Effect.void);

    yield* CouchViewService.warm(dbName, designName, viewName);

    expect(requestGet.calledOnceWithExactly(`/${dbName}/_design/${designName}/_view/${viewName}`)).to.be.true;
    expect(requestSetUrlParam.calledOnceWithExactly('limit', '0')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));
});
