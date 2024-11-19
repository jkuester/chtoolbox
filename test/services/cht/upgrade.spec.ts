import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { ChtUpgradeService } from '../../../src/services/cht/upgrade';
import { ResponseError } from '@effect/platform/HttpClientError';
import { genWithLayer, sandbox } from '../../utils/base';

const version = '3.7.0';
const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { goodby: 'world' } as const;

const chtRequest = sandbox.stub();
const requestBuild = sandbox.stub();

const run = ChtUpgradeService.Default.pipe(
  Layer.provide(Layer.succeed(ChtClientService, { request: chtRequest } as unknown as ChtClientService)),
  genWithLayer,
);

describe('CHT Upgrade Service', () => {
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;

  beforeEach(() => {
    requestSchemaBody = sinon.stub(HttpClientRequest, 'schemaBodyJson').returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
  });

  ([
    ['upgrade', ChtUpgradeService.upgrade, '/api/v1/upgrade'],
    ['stage', ChtUpgradeService.stage, '/api/v1/upgrade/stage'],
    ['complete', ChtUpgradeService.complete, '/api/v1/upgrade/complete'],
  ] as unknown as [
    string,
    (version: string) => Effect.Effect<HttpClientResponse.HttpClientResponse, Error, ChtUpgradeService>,
    string
  ][]).forEach(([name, fn, endpoint]) => {
    describe(name, () => {
      it(`posts given upgrade version to ${endpoint}`, run(function* () {
        const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
        requestPost.returns(FAKE_CLIENT_REQUEST);
        requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
        chtRequest.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));

        const response = yield* fn(version);

        expect(response).to.equal(FAKE_CLIENT_RESPONSE);
        expect(chtRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
        expect(requestBuild.calledOnceWithExactly(
          FAKE_CLIENT_REQUEST,
          { build: { namespace: 'medic', application: 'medic', version } }
        )).to.be.true;
        expect(requestSchemaBody.calledOnce).to.be.true;
        expect(requestPost.calledOnceWithExactly(endpoint)).to.be.true;
      }));

      it('returns error if request cannot be built', run(function* () {
        const expectedError = Error('Cannot build request.');
        requestPost.returns(FAKE_CLIENT_REQUEST);
        requestBuild.returns(Effect.fail(expectedError));

        const either = yield* Effect.either(fn(version));

        if (Either.isLeft(either)) {
          expect(either.left).to.equal(expectedError);
          expect(chtRequest.notCalled).to.be.true;
          expect(requestBuild.calledOnceWithExactly(
            FAKE_CLIENT_REQUEST,
            { build: { namespace: 'medic', application: 'medic', version } }
          )).to.be.true;
          expect(requestSchemaBody.calledOnce).to.be.true;
          expect(requestPost.calledOnceWithExactly(endpoint)).to.be.true;
        } else {
          expect.fail('Expected error to be thrown.');
        }
      }));
    });
  });

  it('complete will quietly handle 502 errors from server restart', run(function* () {
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
    chtRequest.returns(Effect.fail(new ResponseError({
      request: {} as HttpClientRequest.HttpClientRequest,
      response: { status: 502 } as HttpClientResponse.HttpClientResponse,
      reason: 'StatusCode'
    })));

    const response = yield* ChtUpgradeService.complete(version);

    expect(response).to.be.undefined;
    expect(chtRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(
      FAKE_CLIENT_REQUEST,
      { build: { namespace: 'medic', application: 'medic', version } }
    )).to.be.true;
    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestPost.calledOnceWithExactly('/api/v1/upgrade/complete')).to.be.true;
  }));
});
