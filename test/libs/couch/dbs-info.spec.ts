import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import { createDbInfo } from '../../utils/data-models.ts';
import { type NonEmptyArray } from 'effect/Array';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import * as DbsInfoLibs from '../../../src/libs/couch/dbs-info.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  schemaBodyJson: sandbox.stub(),
  post: sandbox.stub(),
  get: sandbox.stub()
};
const requestBuild = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const {
  getAllDbsInfo,
  getDbNames,
  getDbsInfoByName
} = await esmock<typeof DbsInfoLibs>('../../../src/libs/couch/dbs-info.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Dbs Info libs', () => {
  beforeEach(() => mockHttpRequest.schemaBodyJson.returns(requestBuild));

  it('gets db info for all databases', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
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
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed([testDbInfo, emptyDbInfo]),
    }));

    const dbInfos = yield* getAllDbsInfo();

    expect(dbInfos).to.deep.equal([testDbInfo, emptyDbInfo]);
    expect(mockHttpRequest.get.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(requestBuild.notCalled).to.be.true;
    expect(mockHttpRequest.schemaBodyJson.notCalled).to.be.true;
    expect(mockHttpRequest.post.notCalled).to.be.true;
  }));

  it('gets db names for all databases', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const testDbInfo = createDbInfo({ key: 'test', compact_running: true, file: 123, active: 234 });
    const emptyDbInfo = createDbInfo();
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed([testDbInfo, emptyDbInfo]),
    }));

    const dbNames = yield* getDbNames();

    expect(dbNames).to.deep.equal([testDbInfo.key, emptyDbInfo.key]);
    expect(mockHttpRequest.get.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(requestBuild.notCalled).to.be.true;
    expect(mockHttpRequest.schemaBodyJson.notCalled).to.be.true;
    expect(mockHttpRequest.post.notCalled).to.be.true;
  }));

  describe('post', () => {
    it('posts db info for specified databases', run(function* () {
      const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
      mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
      requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));
      const medicDbInfo = createDbInfo({ key: 'medic', compact_running: true, file: 123, active: 234 });
      const sentinelDbInfo = createDbInfo({ key: 'medic-sentinel', file: 12 });
      const usersMetaDbInfo = createDbInfo({ key: 'medic-users-meta', compact_running: true, active: 23412 });
      const usersDbInfo = createDbInfo({ key: '_users', compact_running: true, file: 54, active: 23232 });
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]),
      }));
      const dbNames: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

      const dbInfos = yield* getDbsInfoByName(dbNames);

      expect(dbInfos).to.deep.equal([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]);
      expect(mockHttpRequest.get.notCalled).to.be.true;
      expect(mockChtClient.request.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
      expect(requestBuild.calledOnceWithExactly(
        FAKE_CLIENT_REQUEST,
        { keys: dbNames }
      )).to.be.true;
      expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
      expect(mockHttpRequest.post.calledOnceWithExactly('/_dbs_info')).to.be.true;
    }));

    it('returns error if request cannot be built', run(function* () {
      const expectedError = Error('Cannot build request.');
      mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
      requestBuild.returns(Effect.fail(expectedError));
      const dbNames: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

      const either = yield* Effect.either(getDbsInfoByName(dbNames));

      if (Either.isRight(either)) {
        expect.fail('Expected error to be thrown.');
      }

      expect(either.left).to.include(expectedError);
      expect(mockHttpRequest.get.notCalled).to.be.true;
      expect(mockChtClient.request.notCalled).to.be.true;
      expect(requestBuild.calledOnceWithExactly(
        FAKE_CLIENT_REQUEST,
        { keys: dbNames }
      )).to.be.true;
      expect(mockHttpRequest.schemaBodyJson.calledOnce).to.be.true;
      expect(mockHttpRequest.post.calledOnceWithExactly('/_dbs_info')).to.be.true;
    }));
  });
});
