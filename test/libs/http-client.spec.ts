import { describe, it } from 'mocha';
import { Effect, Layer, Schema } from 'effect';
import { expect } from 'chai';
import * as HttpClientLibs from '../../src/libs/http-client.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';
import sinon, { type SinonStub } from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockHttpRequest = {
  schemaBodyJson: sandbox.stub(),
  post: sandbox.stub(),
};

const run = genWithLayer(Layer.empty);
const {
  buildPostRequest
}  = await esmock<typeof HttpClientLibs>('../../src/libs/http-client.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Http CLient libs', () => {
  let buildRequest: SinonStub;

  beforeEach(() => {
    buildRequest = sinon.stub();
    mockHttpRequest.schemaBodyJson.returns(buildRequest);
  });

  it('buildPostRequest', run(function* () {
    const requestStruct = Schema.Struct({
      version: Schema.String,
    });
    const endpoint = '/version';
    const version = '3.7.0';

    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    buildRequest.returns(Effect.succeed(fakeBuiltClientRequest));

    const response = yield* buildPostRequest(endpoint, requestStruct)({ version });

    expect(response).to.equal(fakeBuiltClientRequest);
    expect(buildRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST, { version })).to.be.true;
    expect(mockHttpRequest.schemaBodyJson.calledOnceWithExactly(requestStruct)).to.be.true;
    expect(mockHttpRequest.post.calledOnceWithExactly(endpoint)).to.be.true;
  }));
});
