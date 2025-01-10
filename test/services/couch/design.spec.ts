import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { getViewNames } from '../../../src/services/couch/design';
import { genWithLayer, sandbox } from '../../utils/base';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch Design Service', () => {
  let requestGet: SinonStub;

  beforeEach(() => {
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  it('gets view names for a database and design', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
      views: {
        'contacts_by_freetext': {},
        'contacts_by_last_visited': {},
        'contacts_by_parent': {},
      },
    };
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const dbInfos = yield* getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal(Object.keys(designData.views));
    expect(requestGet.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));

  it('returns an empty array if no views exist', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
    };
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const dbInfos = yield* getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal([]);
    expect(requestGet.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
