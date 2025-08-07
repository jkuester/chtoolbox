import { describe, it } from 'mocha';
import { Effect, Layer, pipe } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as ViewLib from '../../../src/libs/couch/view.js';
import { genWithLayer, sandbox } from '../../utils/base.js';
import esmock from 'esmock'

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  get: sandbox.stub(),
  setUrlParam: sandbox.stub()
};

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { warmView } = await esmock<typeof ViewLib>('../../../src/libs/couch/view.js', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch View lib', () => {
  it('warms given database view', run(function* () {
    const dbName = 'test-db';
    const designName = 'test-design';
    const viewName = 'test-view';
    mockHttpRequest.setUrlParam.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.void);
    mockHttpRequest.get.returns({ pipe });

    yield* warmView(dbName, designName, viewName);

    expect(mockHttpRequest.get.calledOnceWithExactly(`/${dbName}/_design/${designName}/_view/${viewName}`)).to.be.true;
    expect(mockHttpRequest.setUrlParam.calledOnceWithExactly('limit', '0')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
