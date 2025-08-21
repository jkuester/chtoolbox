import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as ViewLib from '../../../src/libs/couch/view.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';
import sinon from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_REQUEST_WITH_PARAMS = { hello: 'world', limit: '0' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  get: sandbox.stub(),
  setUrlParam: sandbox.stub()
};

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { warmView } = await esmock<typeof ViewLib>('../../../src/libs/couch/view.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch View lib', () => {
  it('warms given database view', run(function* () {
    const dbName = 'test-db';
    const designName = 'test-design';
    const viewName = 'test-view';
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const setUrlParamsInner = sinon.stub().returns(FAKE_CLIENT_REQUEST_WITH_PARAMS);
    mockHttpRequest.setUrlParam.returns(setUrlParamsInner);
    mockChtClient.request.returns(Effect.void);

    yield* warmView(dbName, designName, viewName);

    expect(mockHttpRequest.get.calledOnceWithExactly(`/${dbName}/_design/${designName}/_view/${viewName}`)).to.be.true;
    expect(mockHttpRequest.setUrlParam.calledOnceWithExactly('limit', '0')).to.be.true;
    expect(setUrlParamsInner).to.have.been.calledOnceWithExactly(FAKE_CLIENT_REQUEST);
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST_WITH_PARAMS)).to.be.true;
  }));
});
