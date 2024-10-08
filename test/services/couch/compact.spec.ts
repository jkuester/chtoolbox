import { describe, it } from 'mocha';
import { Effect, Either, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchCompactService, CouchCompactServiceLive } from '../../../src/services/couch/compact';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch Compact Service', () => {
  let couchRequest: SinonStub;
  let requestBuild: SinonStub;
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestBuild = sinon.stub();
    requestSchemaBody = sinon.stub(HttpClientRequest, 'schemaBody').returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchCompactService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchCompactServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, CouchService.of({
        request: couchRequest,
      }))),
    ));
  };

  it('posts _compact for the given database', run(Effect.gen(function* () {
    const dbName = 'db-name';
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    const service = yield* CouchCompactService;
    yield* service.compactDb(dbName);

    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  })));

  it('posts _compact for the given design', run(Effect.gen(function* () {
    const dbName = 'db-name';
    const designName = 'design-name';
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    const service = yield* CouchCompactService;
    yield* service.compactDesign(dbName, designName);

    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact/${designName}`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  })));

  it('returns error if request cannot be built', run(Effect.gen(function* () {
    const expectedError = Error('Cannot build request.');
    const dbName = 'db-name';
    requestPost.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.fail(expectedError));

    const service = yield* CouchCompactService;
    const either = yield* Effect.either(service.compactDb(dbName));

    if (Either.isLeft(either)) {
      expect(either.left).to.equal(expectedError);
      expect(requestSchemaBody.calledOnce).to.be.true;
      expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
      expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact`)).to.be.true;
      expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
      expect(couchRequest.notCalled).to.be.true;
    } else {
      expect.fail('Expected error to be thrown.');
    }
  })));
});
