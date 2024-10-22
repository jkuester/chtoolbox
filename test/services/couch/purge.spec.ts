import { afterEach, describe, it } from 'mocha';
import { Array, Effect, Either, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { CouchPurgeService, purgeFrom } from '../../../src/services/couch/purge';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const FAKE_CLIENT_RESPONSE = { world: 'hello' } as const;

describe('Couch Purge Service', () => {
  let couchRequest: SinonStub;
  let requestBuild: SinonStub;
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestBuild = sinon.stub();
    requestSchemaBody = sinon.stub(HttpClientRequest, 'schemaBodyJson').returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchPurgeService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchPurgeService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(ChtClientService, {
        request: couchRequest,
      } as unknown as ChtClientService)),
    ));
  };

  describe('purge', () => {
    it('purges identified docs', run(Effect.gen(function* () {
      const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
      requestPost.returns(FAKE_CLIENT_REQUEST);
      requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
      couchRequest.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));
      const dbName = 'medic';
      const docs= Array.make({ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' });

      const response = yield* CouchPurgeService.purge(dbName, docs);

      expect(response).to.deep.equal(FAKE_CLIENT_RESPONSE);
      expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
      expect(requestBuild.calledOnceWithExactly(
        FAKE_CLIENT_REQUEST,
        { [docs[0]._id]: [docs[0]._rev], [docs[1]._id]: [docs[1]._rev] }
      )).to.be.true;
      expect(requestSchemaBody.calledOnce).to.be.true;
      expect(requestPost.calledOnceWithExactly(`/${dbName}/_purge`)).to.be.true;
    })));

    it('returns error if request cannot be built', run(Effect.gen(function* () {
      const expectedError = Error('Cannot build request.');
      requestPost.returns(FAKE_CLIENT_REQUEST);
      requestBuild.returns(Effect.fail(expectedError));
      const dbName = 'medic';
      const docs= Array.make({ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' });

      const either = yield* Effect.either(CouchPurgeService.purge(dbName, docs));

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
    })));
  });

  it('purgeFrom', run(Effect.gen(function* () {
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
    couchRequest.returns(Effect.succeed(FAKE_CLIENT_RESPONSE));
    const dbName = 'medic';
    const docs = Array.make({ _id: 'doc1', _rev: 'rev1' }, { _id: 'doc2', _rev: 'rev2' });

    const response = yield* purgeFrom(dbName)(docs);

    expect(response).to.deep.equal(FAKE_CLIENT_RESPONSE);
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(
      FAKE_CLIENT_REQUEST,
      { [docs[0]._id]: [docs[0]._rev], [docs[1]._id]: [docs[1]._rev] }
    )).to.be.true;
    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_purge`)).to.be.true;
  })));
});
