import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { genWithLayer, sandbox } from '../../utils/base';
import { compactDb, compactDesign } from '../../../src/libs/couch/compact';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();
const requestBuild = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch Compact libs', () => {
  let requestSchemaBody: SinonStub;
  let requestPost: SinonStub;

  beforeEach(() => {
    requestSchemaBody = sinon.stub(HttpClientRequest, 'schemaBodyJson').returns(requestBuild);
    requestPost = sinon.stub(HttpClientRequest, 'post');
  });

  it('posts _compact for the given database', run(function* () {
    const dbName = 'db-name';
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    yield* compactDb(dbName);

    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  }));

  it('posts _compact for the given design', run(function* () {
    const dbName = 'db-name';
    const designName = 'design-name';
    const fakeBuiltClientRequest = { ...FAKE_CLIENT_REQUEST, built: true };
    requestPost.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.succeed(fakeBuiltClientRequest));

    yield* compactDesign(dbName, designName);

    expect(requestSchemaBody.calledOnce).to.be.true;
    expect(requestSchemaBody.args[0][0]).to.deep.include({ fields: {} });
    expect(requestPost.calledOnceWithExactly(`/${dbName}/_compact/${designName}`)).to.be.true;
    expect(requestBuild.calledOnceWithExactly(FAKE_CLIENT_REQUEST, {})).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeBuiltClientRequest)).to.be.true;
  }));

  it('returns error if request cannot be built', run(function* () {
    const expectedError = Error('Cannot build request.');
    const dbName = 'db-name';
    requestPost.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.void);
    requestBuild.returns(Effect.fail(expectedError));

    const either = yield* Effect.either(compactDb(dbName));

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
  }));
});
