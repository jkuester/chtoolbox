import { describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchCompactService, CouchCompactServiceLive } from '../../../src/services/couch/compact';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';

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
    const fakeClientRequest = { hello: 'world' };
    const fakeBuiltClientRequest = { ...fakeClientRequest, built: true };
    requestPost.returns(fakeClientRequest);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    const service = yield* CouchCompactService;
    yield* service.compactDb(dbName);

    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(fakeClientRequest, {})).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  })));

  it('posts _compact for the given design', run(Effect.gen(function* () {
    const dbName = 'db-name';
    const designName = 'design-name';
    const fakeClientRequest = { hello: 'world' };
    const fakeBuiltClientRequest = { ...fakeClientRequest, built: true };
    requestPost.returns(fakeClientRequest);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    const service = yield* CouchCompactService;
    yield* service.compactDesign(dbName, designName);

    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact/${designName}`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(fakeClientRequest, {})).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  })));
});
