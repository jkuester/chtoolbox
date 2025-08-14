import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as UpgradeLibs from '../../../src/libs/cht/upgrade.ts';
import { ResponseError } from '@effect/platform/HttpClientError';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';
import sinon, { type SinonStub } from 'sinon';

const version = '3.7.0';
const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { goodby: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  schemaBodyJson: sandbox.stub(),
  post: sandbox.stub(),
};

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const {
  completeChtUpgrade,
  stageChtUpgrade,
  upgradeCht
}  = await esmock<typeof UpgradeLibs>('../../../src/libs/cht/upgrade.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('CHT Upgrade libs', () => {
  let buildBody: SinonStub;
  let buildRequest: SinonStub;

  beforeEach(() => {
    buildRequest = sinon.stub();
    buildBody = sinon.stub().returns(buildRequest);
    mockHttpRequest.schemaBodyJson.returns(buildBody);
  });

  ([
    ['upgrade', upgradeCht, '/api/v1/upgrade'],
    ['stage', stageChtUpgrade, '/api/v1/upgrade/stage'],
    ['complete', completeChtUpgrade, '/api/v1/upgrade/complete'],
  ] as unknown as [
    string,
    (version: string) => Effect.Effect<HttpClientResponse.HttpClientResponse, Error, ChtClientService>,
    string
  ][]).forEach(([name, fn, endpoint]) => {
    describe(name, () => {
      it(`posts given upgrade version to ${endpoint}`, run(function* () {
        const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
        mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
        buildRequest.returns(Effect.succeed(fakeBuiltClientRequest));
        mockChtClient.request.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));

        const response = yield* fn(version);

        expect(response).to.equal(FAKE_CLIENT_RESPONSE);
        expect(mockChtClient.request.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
        expect(buildBody.calledOnceWithExactly(
          { build: { namespace: 'medic', application: 'medic', version } }
        )).to.be.true;
        expect(buildRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
        expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
        expect(mockHttpRequest.post.calledOnceWithExactly(endpoint)).to.be.true;
      }));

      it('returns error if request cannot be built', run(function* () {
        const expectedError = Error('Cannot build request.');
        mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
        buildRequest.returns(Effect.fail(expectedError));

        const either = yield* Effect.either(fn(version));

        if (Either.isRight(either)) {
          expect.fail('Expected error to be thrown.');
        }

        expect(either.left).to.include(expectedError);
        expect(mockChtClient.request.notCalled).to.be.true;
        expect(buildBody.calledOnceWithExactly(
          { build: { namespace: 'medic', application: 'medic', version } }
        )).to.be.true;
        expect(buildRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
        expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
        expect(mockHttpRequest.post.calledOnceWithExactly(endpoint)).to.be.true;
      }));
    });
  });

  it('complete will quietly handle 502 errors from server restart', run(function* () {
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    buildRequest.returns(Effect.succeed(fakeBuiltClientRequest));
    mockChtClient.request.returns(Effect.fail(new ResponseError({
      request: {} as HttpClientRequest.HttpClientRequest,
      response: { status: 502 } as HttpClientResponse.HttpClientResponse,
      reason: 'StatusCode'
    })));

    const response = yield* completeChtUpgrade(version);

    expect(response).to.be.undefined;
    expect(mockChtClient.request.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
    expect(buildBody.calledOnceWithExactly(
      { build: { namespace: 'medic', application: 'medic', version } }
    )).to.be.true;
    expect(buildRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
    expect(mockHttpRequest.post.calledOnceWithExactly('/api/v1/upgrade/complete')).to.be.true;
  }));
});
