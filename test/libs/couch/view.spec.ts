import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonSpy, SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client.js';
import { HttpClientRequest } from '@effect/platform';
import { warmView } from '../../../src/libs/couch/view.js';
import { genWithLayer, sandbox } from '../../utils/base.js';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch View lib', () => {
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

    yield* warmView(dbName, designName, viewName);

    expect(requestGet.calledOnceWithExactly(`/${dbName}/_design/${designName}/_view/${viewName}`)).to.be.true;
    expect(requestSetUrlParam.calledOnceWithExactly('limit', '0')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
