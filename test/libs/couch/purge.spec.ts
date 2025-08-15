import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as PurgeLibs from '../../../src/libs/couch/purge.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';
import sinon, { type SinonStub } from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { world: 'hello' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpClient = { buildPostRequest: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { purgeFrom } = await esmock<typeof PurgeLibs>('../../../src/libs/couch/purge.ts', {
  '../../../src/libs/http-client.ts': mockHttpClient
});

describe('Couch Purge libs', () => {
  let buildPostRequestInner: SinonStub;

  beforeEach(() => {
    buildPostRequestInner = sinon.stub();
    mockHttpClient.buildPostRequest.returns(buildPostRequestInner);
  });

  it('purges identified docs', run(function* () {
    buildPostRequestInner.returns(Effect.succeed(FAKE_CLIENT_REQUEST));
    mockChtClient.request.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));
    const dbName = 'medic';
    const docs= [{ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' }] as const;

    const response = yield* purgeFrom(dbName)(docs);

    expect(response).to.deep.equal(FAKE_CLIENT_RESPONSE);
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(mockHttpClient.buildPostRequest.calledOnceWith(`/${dbName}/_purge`)).to.be.true;
    expect(buildPostRequestInner.calledOnceWithExactly({
      [docs[0]._id]: [docs[0]._rev],
      [docs[1]._id]: [docs[1]._rev]
    })).to.be.true;
  }));

  it('returns error if request cannot be built', run(function* () {
    const expectedError = Error('Cannot build request.');
    buildPostRequestInner.returns(Effect.fail(expectedError));
    const dbName = 'medic';
    const docs= [{ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' }] as const;

    const either = yield* Effect.either(purgeFrom(dbName)(docs));

    if (Either.isRight(either)) {
      expect.fail('Expected error to be thrown.');
    }

    expect(either.left).to.include(expectedError);
    expect(mockChtClient.request.notCalled).to.be.true;
    expect(mockHttpClient.buildPostRequest.calledOnceWith(`/${dbName}/_purge`)).to.be.true;
    expect(buildPostRequestInner.calledOnceWithExactly({
      [docs[0]._id]: [docs[0]._rev],
      [docs[1]._id]: [docs[1]._rev]
    })).to.be.true;
  }));
});
