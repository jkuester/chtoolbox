import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import * as CompactLibs from '../../../src/libs/couch/compact.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  schemaBodyJson: sandbox.stub(),
  post: sandbox.stub()
};
const requestBuild = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { compactDb, compactDesign } = await esmock<typeof CompactLibs>('../../../src/libs/couch/compact.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Compact libs', () => {
  beforeEach(() => mockHttpRequest.schemaBodyJson.returns(requestBuild));

  it('posts _compact for the given database', run(function* () {
    const dbName = 'db-name';
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    yield* compactDb(dbName);

    expect(mockHttpRequest.schemaBodyJson).to.have.been.calledOnce;
    expect(mockHttpRequest.schemaBodyJson).to.have.been.calledWithMatch({ fields: {} });
    expect(mockHttpRequest.post.calledOnceWithExactly(`/${dbName}/_compact`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  }));

  it('posts _compact for the given design', run(function* () {
    const dbName = 'db-name';
    const designName = 'design-name';
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    yield* compactDesign(dbName, designName);

    expect(mockHttpRequest.schemaBodyJson).to.have.been.calledOnce;
    expect(mockHttpRequest.schemaBodyJson).to.have.been.calledWithMatch({ fields: {} });
    expect(mockHttpRequest.post.calledOnceWithExactly(`/${dbName}/_compact/${designName}`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  }));

  it('returns error if request cannot be built', run(function* () {
    const expectedError = Error('Cannot build request.');
    const dbName = 'db-name';
    mockHttpRequest.post.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.void);
    requestBuild.returns(Effect.fail(expectedError));

    const either = yield* Effect.either(compactDb(dbName));

    if (Either.isLeft(either)) {
      expect(either.left).to.equal(expectedError);
      expect(mockHttpRequest.schemaBodyJson).to.have.been.calledOnce;
      expect(mockHttpRequest.schemaBodyJson).to.have.been.calledWithMatch({ fields: {} });
      expect(mockHttpRequest.post.calledOnceWithExactly(`/${dbName}/_compact`)).to.be.true;
      expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
      expect(mockChtClient.request.notCalled).to.be.true;
    } else {
      expect.fail('Expected error to be thrown.');
    }
  }));
});
