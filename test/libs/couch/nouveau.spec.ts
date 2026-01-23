import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as NouveauLib from '../../../src/libs/couch/nouveau.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';
import sinon from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_REQUEST_WITH_LIMIT = { hello: 'world', limit: '1' } as const;
const FAKE_CLIENT_REQUEST_WITH_QUERY = { hello: 'world', limit: '1', q: '*:*' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  get: sandbox.stub(),
  setUrlParam: sandbox.stub()
};

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { warmNouveau } = await esmock<typeof NouveauLib>('../../../src/libs/couch/nouveau.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Nouveau lib', () => {
  it('warms given nouveau index', run(function* () {
    const dbName = 'test-db';
    const ddocId = '_design/test-ddoc';
    const indexName = 'test-index';
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const setUrlParamLimit = sinon.stub().returns(FAKE_CLIENT_REQUEST_WITH_LIMIT);
    const setUrlParamQuery = sinon.stub().returns(FAKE_CLIENT_REQUEST_WITH_QUERY);
    mockHttpRequest.setUrlParam
      .onFirstCall().returns(setUrlParamLimit)
      .onSecondCall().returns(setUrlParamQuery);
    mockChtClient.request.returns(Effect.void);

    yield* warmNouveau(dbName, ddocId)(indexName);

    expect(mockHttpRequest.get.calledOnceWithExactly(`/${dbName}/${ddocId}/_nouveau/${indexName}`)).to.be.true;
    expect(mockHttpRequest.setUrlParam.firstCall.calledWithExactly('limit', '1')).to.be.true;
    expect(mockHttpRequest.setUrlParam.secondCall.calledWithExactly('q', '*:*')).to.be.true;
    expect(setUrlParamLimit).to.have.been.calledOnceWithExactly(FAKE_CLIENT_REQUEST);
    expect(setUrlParamQuery).to.have.been.calledOnceWithExactly(FAKE_CLIENT_REQUEST_WITH_LIMIT);
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST_WITH_QUERY)).to.be.true;
  }));
});
