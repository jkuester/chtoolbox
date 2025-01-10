import { describe, it } from 'mocha';
import { Array, Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { purgeFrom } from '../../../src/services/couch/purge';
import { genWithLayer, sandbox } from '../../utils/base';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { world: 'hello' } as const;

const couchRequest = sandbox.stub();
const requestBuild = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch Purge Service', () => {
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;

  beforeEach(() => {
    requestSchemaBody = sinon.stub(HttpClientRequest, 'schemaBodyJson').returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
  });

  it('purges identified docs', run(function* () {
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
    couchRequest.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));
    const dbName = 'medic';
    const docs= Array.make({ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' });

    const response = yield* purgeFrom(dbName)(docs);

    expect(response).to.deep.equal(FAKE_CLIENT_RESPONSE);
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(
      FAKE_CLIENT_REQUEST,
      { [docs[0]._id]: [docs[0]._rev], [docs[1]._id]: [docs[1]._rev] }
    )).to.be.true;
    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_purge`)).to.be.true;
  }));

  it('returns error if request cannot be built', run(function* () {
    const expectedError = Error('Cannot build request.');
    requestPost.returns(FAKE_CLIENT_REQUEST);
    requestBuild.returns(Effect.fail(expectedError));
    const dbName = 'medic';
    const docs= Array.make({ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' });

    const either = yield* Effect.either(purgeFrom(dbName)(docs));

    if (Either.isLeft(either)) {
      expect(either.left).to.equal(expectedError);
      expect(couchRequest.notCalled).to.be.true;
      expect(requestBuild.calledOnceWithExactly(
        FAKE_CLIENT_REQUEST,
        { [docs[0]._id]: [docs[0]._rev], [docs[1]._id]: [docs[1]._rev] }
      )).to.be.true;
      expect(requestSchemaBody.calledOnce).to.be.true;
      expect(requestPost.calledOnceWithExactly(`/${dbName}/_purge`)).to.be.true;
    } else {
      expect.fail('Expected error to be thrown.');
    }
  }));
});
