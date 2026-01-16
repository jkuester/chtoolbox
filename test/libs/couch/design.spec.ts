import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as DesignLibs from '../../../src/libs/couch/design.ts';
import { CouchDesign } from '../../../src/libs/couch/design.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';
import sinon from 'sinon';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = {
  get: sandbox.stub(),
  del: sandbox.stub(),
  setUrlParam: sandbox.stub()
};

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getViewNames, getCouchDesign, deleteCouchDesign } = await esmock<typeof DesignLibs>(
  '../../../src/libs/couch/design.ts',
  {
    '@effect/platform': {
      HttpClientRequest: mockHttpRequest
    }
  }
);

describe('Couch Design libs', () => {
  it('getCouchDesign returns design doc with _rev', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
      _rev: '1-abc123',
      views: {
        'contacts_by_freetext': {},
        'contacts_by_last_visited': {},
        'contacts_by_parent': {},
      },
      nouveau: {
        'contacts_by_freetext': {},
      },
      build_info: {
        base_version: 'hello world'
      }
    };
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const result = yield* getCouchDesign('medic', designData._id);

    expect(result).to.deep.include(designData);
    expect(mockHttpRequest.get.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));

  it('gets view names for a database and design', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
      _rev: '1-abc',
      views: {
        'contacts_by_freetext': {},
        'contacts_by_last_visited': {},
        'contacts_by_parent': {},
      },
    };
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const dbInfos = yield* getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal(Object.keys(designData.views));
    expect(mockHttpRequest.get.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));

  it('returns an empty array if no views exist', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
      _rev: '1-abc',
    };
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const dbInfos = yield* getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal([]);
    expect(mockHttpRequest.get.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));

  describe('deleteCouchDesign', () => {
    it('deletes a design doc using _id and _rev', run(function* () {
      const deleteRequest = { delete: 'request' };
      mockHttpRequest.del.returns(deleteRequest);
      const requestWithRev = { ...deleteRequest, rev: '1-abc' };
      const setUrlParamInner = sinon.stub().returns(requestWithRev);
      mockHttpRequest.setUrlParam.returns(setUrlParamInner);
      const expectedResponse = { ok: true };
      mockChtClient.request.returns(Effect.succeed(expectedResponse));
      const designDoc = new CouchDesign({
        _id: '_design/medic',
        _rev: '1-abc',
        views: undefined,
        deploy_info: undefined,
        nouveau: undefined,
        build_info: undefined,
      });

      const result = yield* deleteCouchDesign('medic')(designDoc);

      expect(result).to.equal(expectedResponse);
      expect(mockHttpRequest.del).to.have.been.calledOnceWithExactly('/medic/_design/medic');
      expect(mockHttpRequest.setUrlParam).to.have.been.calledOnceWithExactly('rev', '1-abc');
      expect(setUrlParamInner).to.have.been.calledOnceWithExactly(deleteRequest);
      expect(mockChtClient.request).to.have.been.calledOnceWithExactly(requestWithRev);
    }));

    it('fails when design doc has no _rev', run(function* () {
      const designDoc = new CouchDesign({
        _id: '_design/medic',
        _rev: undefined,
        views: undefined,
        deploy_info: undefined,
        nouveau: undefined,
        build_info: undefined,
      });

      const either = yield* deleteCouchDesign('medic')(designDoc).pipe(
        Effect.catchAllDefect(defect => Effect.fail(defect)),
        Effect.either
      );

      expect(either._tag).to.equal('Left');
      expect(mockHttpRequest.del).to.not.have.been.called;
      expect(mockChtClient.request).to.not.have.been.called;
    }));
  });
});
