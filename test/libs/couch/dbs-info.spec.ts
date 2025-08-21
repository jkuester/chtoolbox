import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import { createDbInfo } from '../../utils/data-models.ts';
import { type NonEmptyArray } from 'effect/Array';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import * as DbsInfoLibs from '../../../src/libs/couch/dbs-info.ts';
import esmock from 'esmock';
import sinon, { type SinonStub } from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };
const mockHttpClient = { buildPostRequest: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const {
  allDbsInfoEffect,
  getDbNames,
  getDbsInfoByName
} = await esmock<typeof DbsInfoLibs>('../../../src/libs/couch/dbs-info.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '../../../src/libs/http-client.ts': mockHttpClient
});

describe('Couch Dbs Info libs', () => {
  let buildPostRequestInner: SinonStub;

  beforeEach(() => {
    buildPostRequestInner = sinon.stub();
    mockHttpClient.buildPostRequest.returns(buildPostRequestInner);
  });

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

    const dbInfos = yield* allDbsInfoEffect;

    expect(dbInfos).to.deep.equal([testDbInfo, emptyDbInfo]);
    expect(mockHttpRequest.get.calledOnceWithExactly('/_dbs_info')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    expect(mockHttpClient.buildPostRequest).to.not.be.called;
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
    expect(mockHttpClient.buildPostRequest).to.not.be.called;
  }));

  describe('post', () => {
    it('posts db info for specified databases', run(function* () {
      buildPostRequestInner.returns(Effect.succeed(FAKE_CLIENT_REQUEST));
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
      expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
      expect(mockHttpClient.buildPostRequest.calledOnceWith('/_dbs_info')).to.be.true;
      expect(buildPostRequestInner.calledOnceWithExactly({ keys: dbNames })).to.be.true;
    }));

    it('returns error if request cannot be built', run(function* () {
      const expectedError = Error('Cannot build request.');
      buildPostRequestInner.returns(Effect.fail(expectedError));
      const dbNames: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

      const either = yield* Effect.either(getDbsInfoByName(dbNames));

      if (Either.isRight(either)) {
        expect.fail('Expected error to be thrown.');
      }

      expect(either.left).to.include(expectedError);
      expect(mockHttpRequest.get.notCalled).to.be.true;
      expect(mockChtClient.request.notCalled).to.be.true;
      expect(mockHttpClient.buildPostRequest.calledOnceWith('/_dbs_info')).to.be.true;
      expect(buildPostRequestInner.calledOnceWithExactly({ keys: dbNames })).to.be.true;
    }));
  });
});
