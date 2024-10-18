import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchDesignService } from '../../../src/services/couch/design';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch Design Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchDesignService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchDesignService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, {
        request: couchRequest,
      } as unknown as CouchService)),
    ));
  };

  it('gets view names for a database and design', run(Effect.gen(function* () {
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

    const dbInfos = yield* CouchDesignService.getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal(Object.keys(designData.views));
    expect(requestGet.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));

  it('returns an empty array if no views exist', run(Effect.gen(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const designData = {
      _id: 'medic-client',
    };
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const dbInfos = yield* CouchDesignService.getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal([]);
    expect(requestGet.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));
});
