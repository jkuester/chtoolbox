import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client.js';
import { HttpClientRequest } from '@effect/platform';
import { createDbInfo } from '../../utils/data-models.js';
import { NonEmptyArray } from 'effect/Array';
import { genWithLayer, sandbox } from '../../utils/base.js';
import { getAllDbsInfo, getDbNames, getDbsInfoByName } from '../../../src/libs/couch/dbs-info.js';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();
const requestBuild = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch Dbs Info libs', () => {
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    requestSchemaBody = sinon
      .stub(HttpClientRequest, 'schemaBodyJson')
      .returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  it('gets db info for all databases', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const testDbInfo = createDbInfo({
      key: 'test',
      compact_running: true,
      file: 123,
      external: 23412341,
      active: 234,
      update_seq: 'update_seq',
      purge_seq: 'purge_seq',
      doc_del_count: 12312312,
      doc_count: 123123323423,
      disk_format_version: 42,
      cluster: { q: 1, n: 2, w: 3, r: 4 },
      instance_start_time: '12312312312',
    });
    const emptyDbInfo = createDbInfo();
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed([testDbInfo, emptyDbInfo]),
    }));

    const dbInfos = yield* getAllDbsInfo();

    expect(dbInfos).to.deep.equal([testDbInfo, emptyDbInfo]);
    expect(requestGet.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(requestBuild.notCalled).to.be.true;
    expect(requestSchemaBody.notCalled).to.be.true;
    expect(requestPost.notCalled).to.be.true;
  }));

  it('gets db names for all databases', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const testDbInfo = createDbInfo({ key: 'test', compact_running: true, file: 123, active: 234 });
    const emptyDbInfo = createDbInfo();
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed([testDbInfo, emptyDbInfo]),
    }));

    const dbNames = yield* getDbNames();

    expect(dbNames).to.deep.equal([testDbInfo.key, emptyDbInfo.key]);
    expect(requestGet.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(requestBuild.notCalled).to.be.true;
    expect(requestSchemaBody.notCalled).to.be.true;
    expect(requestPost.notCalled).to.be.true;
  }));

  describe('post', () => {
    it('posts db info for specified databases', run(function* () {
      const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
      requestPost.returns(FAKE_CLIENT_REQUEST);
      requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
      const medicDbInfo = createDbInfo({ key: 'medic', compact_running: true, file: 123, active: 234 });
      const sentinelDbInfo = createDbInfo({ key: 'medic-sentinel', file: 12 });
      const usersMetaDbInfo = createDbInfo({ key: 'medic-users-meta', compact_running: true, active: 23412 });
      const usersDbInfo = createDbInfo({ key: '_users', compact_running: true, file: 54, active: 23232 });
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]),
      }));
      const dbNames: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

      const dbInfos = yield* getDbsInfoByName(dbNames);

      expect(dbInfos).to.deep.equal([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]);
      expect(requestGet.notCalled).to.be.true;
      expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
      expect(requestBuild.calledOnceWithExactly(
        FAKE_CLIENT_REQUEST,
        { keys: dbNames }
      )).to.be.true;
      expect(requestSchemaBody.calledOnce).to.be.true;
      expect(requestPost.calledOnceWithExactly('/_dbs_info')).to.be.true;
    }));

    it('returns error if request cannot be built', run(function* () {
      const expectedError = Error('Cannot build request.');
      requestPost.returns(FAKE_CLIENT_REQUEST);
      requestBuild.returns(Effect.fail(expectedError));
      const dbNames: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

      const either = yield* Effect.either(getDbsInfoByName(dbNames));

      if (Either.isLeft(either)) {
        expect(either.left).to.equal(expectedError);
        expect(requestGet.notCalled).to.be.true;
        expect(couchRequest.notCalled).to.be.true;
        expect(requestBuild.calledOnceWithExactly(
          FAKE_CLIENT_REQUEST,
          { keys: dbNames }
        )).to.be.true;
        expect(requestSchemaBody.calledOnce).to.be.true;
        expect(requestPost.calledOnceWithExactly('/_dbs_info')).to.be.true;
      } else {
        expect.fail('Expected error to be thrown.');
      }
    }));
  });
});
