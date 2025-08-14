import { afterEach, describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import * as CompactLibs from '../../../src/libs/couch/compact.ts';
import esmock from 'esmock';
import sinon, { type SinonStub } from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { goodbye: 'world' } as const;
const DB_NAME = 'db-name';

const mockChtClient = { request: sandbox.stub() };
const mockHttpClient = { buildPostRequest: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { compactDb, compactDesign } = await esmock<typeof CompactLibs>('../../../src/libs/couch/compact.ts', {
  '../../../src/libs/http-client.ts': mockHttpClient
});

describe('Couch Compact libs', () => {
  let buildPostRequestInner: SinonStub;

  beforeEach(() => {
    buildPostRequestInner = sinon.stub();
    mockHttpClient.buildPostRequest.returns(buildPostRequestInner);
  });

  afterEach(() => expect(buildPostRequestInner.calledOnceWithExactly({})).to.be.true);

  it('posts _compact for the given database', run(function* () {
    buildPostRequestInner.returns(Effect.succeed(FAKE_CLIENT_REQUEST));
    mockChtClient.request.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));

    const response = yield* compactDb(DB_NAME);

    expect(response).to.equal(FAKE_CLIENT_RESPONSE);
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(mockHttpClient.buildPostRequest.calledOnceWith(`/${DB_NAME}/_compact`)).to.be.true;
  }));

  it('posts _compact for the given design', run(function* () {

    const designName = 'design-name';
    buildPostRequestInner.returns(Effect.succeed(FAKE_CLIENT_REQUEST));
    mockChtClient.request.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));

    const response = yield* compactDesign(DB_NAME, designName);

    expect(response).to.equal(FAKE_CLIENT_RESPONSE);
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(mockHttpClient.buildPostRequest.calledOnceWith(`/${DB_NAME}/_compact/${designName}`)).to.be.true;
  }));

  it('returns error if request cannot be built', run(function* () {
    const expectedError = Error('Cannot build request.');
    buildPostRequestInner.returns(Effect.fail(expectedError));

    const either = yield* Effect.either(compactDb(DB_NAME));

    if (Either.isRight(either)) {
      expect.fail('Expected error to be thrown.');
    }

    expect(either.left).to.include(expectedError);
    expect(mockHttpClient.buildPostRequest.calledOnceWith(`/${DB_NAME}/_compact`)).to.be.true;
    expect(mockChtClient.request.notCalled).to.be.true;
  }));
});
