import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as PurgeLibs from '../../../src/libs/couch/purge.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { world: 'hello' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  schemaBodyJson: sandbox.stub(),
  post: sandbox.stub()
};
const requestBuild = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { purgeFrom } = await esmock<typeof PurgeLibs>('../../../src/libs/couch/purge.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Purge libs', () => {
  beforeEach(() => mockHttpRequest.schemaBodyJson.returns(requestBuild));

  it('purges identified docs', run(function* () {
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
    mockChtClient.request.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));
    const dbName = 'medic';
    const docs= [{ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' }] as const;

    const response = yield* purgeFrom(dbName)(docs);

    expect(response).to.deep.equal(FAKE_CLIENT_RESPONSE);
    expect(mockChtClient.request.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(
      FAKE_CLIENT_REQUEST,
      { [docs[0]._id]: [docs[0]._rev], [docs[1]._id]: [docs[1]._rev] }
    )).to.be.true;
    expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
    expect(mockHttpRequest.post.calledOnceWithExactly(`/${dbName}/_purge`)).to.be.true;
  }));

  it('returns error if request cannot be built', run(function* () {
    const expectedError = Error('Cannot build request.');
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    requestBuild.returns(Effect.fail(expectedError));
    const dbName = 'medic';
    const docs= [{ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' }] as const;

    const either = yield* Effect.either(purgeFrom(dbName)(docs));

    if (Either.isRight(either)) {
      expect.fail('Expected error to be thrown.');
    }

    expect(either.left).to.include(expectedError);
    expect(mockChtClient.request.notCalled).to.be.true;
    expect(requestBuild.calledOnceWithExactly(
      FAKE_CLIENT_REQUEST,
      { [docs[0]._id]: [docs[0]._rev], [docs[1]._id]: [docs[1]._rev] }
    )).to.be.true;
    expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
    expect(mockHttpRequest.post.calledOnceWithExactly(`/${dbName}/_purge`)).to.be.true;
  }));
});
