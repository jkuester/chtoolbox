import { afterEach, describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import * as CleanupLibs from '../../../src/libs/couch/cleanup.ts';
import esmock from 'esmock';
import { ResponseError } from '@effect/platform/HttpClientError';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { goodbye: 'world' } as const;
const DB_NAME = 'db-name';

const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { post: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { cleanupDatabaseIndexes } = await esmock<typeof CleanupLibs>('../../../src/libs/couch/cleanup.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Cleanup libs', () => {

  beforeEach(() => {
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));
  });

  afterEach(() => {
    expect(mockHttpRequest.post.args).to.deep.equal([
      [`/${DB_NAME}/_view_cleanup`],
      [`/${DB_NAME}/_nouveau_cleanup`]
    ]);
    expect(mockChtClient.request.args).to.deep.equal([[FAKE_CLIENT_REQUEST], [FAKE_CLIENT_REQUEST]]);
  });

  it('runs both view and nouveau cleanup', run(function* () {
    const response = yield* cleanupDatabaseIndexes(DB_NAME);
    expect(response).to.deep.equal([undefined, undefined]);
  }));

  it('succeeds if nouveau endpoint not existing', run(function* () {
    mockChtClient.request.onSecondCall().returns(Effect.fail(new ResponseError({
      request: FAKE_CLIENT_REQUEST as unknown as HttpClientRequest.HttpClientRequest,
      response: { status: 415 } as unknown as HttpClientResponse.HttpClientResponse,
      reason: 'StatusCode'
    })));

    const response = yield* cleanupDatabaseIndexes(DB_NAME);

    expect(response).to.deep.equal([undefined, undefined]);
  }));

  it('fails for other errors', run(function* () {
    const expectedError = new ResponseError({
      request: FAKE_CLIENT_REQUEST as unknown as HttpClientRequest.HttpClientRequest,
      response: { status: 500 } as unknown as HttpClientResponse.HttpClientResponse,
      reason: 'StatusCode'
    });
    mockChtClient.request.onSecondCall().returns(Effect.fail(expectedError));

    const either = yield* Effect.either(cleanupDatabaseIndexes(DB_NAME));

    if (Either.isRight(either)) {
      expect.fail('Expected error to be thrown.');
    }

    expect(either.left).to.deep.include(expectedError);
  }));
});
