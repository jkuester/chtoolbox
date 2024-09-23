import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchDbsInfoService, CouchDbsInfoServiceLive } from '../../../src/services/couch/dbs-info';
import { createDbInfo } from '../../utils/data-models';

describe('Couch Dbs Info Service', () => {
  let couchRequest: SinonStub;
  let requestBuild: SinonStub;
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestBuild = sinon.stub();
    requestSchemaBody = sinon.stub(HttpClientRequest, 'schemaBody').returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchDbsInfoService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchDbsInfoServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, CouchService.of({
        request: couchRequest,
      }))),
    ));
  };

  it('gets db info for all databases', run(Effect.gen(function* () {
    const fakeClientRequest = { hello: 'world' };
    requestGet.returns(fakeClientRequest);
    const testDbInfo = createDbInfo({ key: 'test', compact_running: true, file: 123, active: 234 });
    const emptyDbInfo = createDbInfo();
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed([testDbInfo, emptyDbInfo]),
    }));

    const service = yield* CouchDbsInfoService;
    const dbInfos = yield* service.get();

    expect(dbInfos).to.deep.equal([testDbInfo, emptyDbInfo]);
    expect(requestGet.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeClientRequest)).to.be.true;
    expect(requestBuild.notCalled).to.be.true;
    expect(requestSchemaBody.notCalled).to.be.true;
    expect(requestPost.notCalled).to.be.true;
  })));

  it('gets db names for all databases', run(Effect.gen(function* () {
    const fakeClientRequest = { hello: 'world' };
    requestGet.returns(fakeClientRequest);
    const testDbInfo = createDbInfo({ key: 'test', compact_running: true, file: 123, active: 234 });
    const emptyDbInfo = createDbInfo();
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed([testDbInfo, emptyDbInfo]),
    }));

    const service = yield* CouchDbsInfoService;
    const dbNames = yield* service.getDbNames();

    expect(dbNames).to.deep.equal([testDbInfo.key, emptyDbInfo.key]);
    expect(requestGet.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeClientRequest)).to.be.true;
    expect(requestBuild.notCalled).to.be.true;
    expect(requestSchemaBody.notCalled).to.be.true;
    expect(requestPost.notCalled).to.be.true;
  })));

  it('posts db info for specified databases', run(Effect.gen(function* () {
    const fakeClientRequest = { hello: 'world' };
    const fakeBuiltClientRequest = { ...fakeClientRequest, built: true };
    requestPost.returns(fakeClientRequest);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
    const medicDbInfo = createDbInfo({ key: 'medic', compact_running: true, file: 123, active: 234 });
    const sentinelDbInfo = createDbInfo({ key: 'medic-sentinel', file: 12 });
    const usersMetaDbInfo = createDbInfo({ key: 'medic-users-meta', compact_running: true, active: 23412 });
    const usersDbInfo = createDbInfo({ key: '_users', compact_running: true, file: 54, active: 23232 });
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]),
    }));

    const service = yield* CouchDbsInfoService;
    const dbInfos = yield* service.post();

    expect(dbInfos).to.deep.equal([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]);
    expect(requestGet.notCalled).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(
      fakeClientRequest,
      { keys: ['medic', 'medic-sentinel', 'medic-users-meta', '_users'] }
    )).to.be.true;
    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestPost.calledOnceWithExactly('/_dbs_info')).to.be.true;
  })));
});
