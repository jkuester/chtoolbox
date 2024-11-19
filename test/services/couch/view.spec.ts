import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonSpy, SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { CouchViewService } from '../../../src/services/couch/view';
import { genWithLayer, sandbox } from '../../utils/base';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();

const run = CouchViewService.Default.pipe(
  Layer.provide(Layer.succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)),
  genWithLayer,
);

describe('Couch View Service', () => {
  let requestGet: SinonSpy;
  let requestSetUrlParam: SinonStub;

  beforeEach(() => {
    requestGet = sinon.spy(HttpClientRequest, 'get');
    requestSetUrlParam = sinon.stub(HttpClientRequest, 'setUrlParam');
  });

  it('warms given database view', run(function* () {
    const dbName = 'test-db';
    const designName = 'test-design';
    const viewName = 'test-view';
    requestSetUrlParam.returns(sinon.stub().returns(FAKE_CLIENT_REQUEST));
    couchRequest.returns(Effect.void);

    yield* CouchViewService.warm(dbName, designName, viewName);

    expect(requestGet.calledOnceWithExactly(`/${dbName}/_design/${designName}/_view/${viewName}`)).to.be.true;
    expect(requestSetUrlParam.calledOnceWithExactly('limit', '0')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
