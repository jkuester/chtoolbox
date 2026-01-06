import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as DesignLibs from '../../../src/libs/couch/design.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getViewNames, getCouchDesign } = await esmock<typeof DesignLibs>('../../../src/libs/couch/design.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Design libs', () => {
  it('getCouchDesign', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
      views: {
        'contacts_by_freetext': {},
        'contacts_by_last_visited': {},
        'contacts_by_parent': {},
      },
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
    };
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const dbInfos = yield* getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal([]);
    expect(mockHttpRequest.get.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
