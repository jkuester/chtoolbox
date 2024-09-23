import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchDesignService, CouchDesignServiceLive } from '../../../src/services/couch/design';

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
      Effect.provide(CouchDesignServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, CouchService.of({
        request: couchRequest,
      }))),
    ));
  };

  it('gets view names for a database and design', run(Effect.gen(function* () {
    const fakeClientRequest = { hello: 'world' };
    requestGet.returns(fakeClientRequest);
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

    const service = yield* CouchDesignService;
    const dbInfos = yield* service.getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal(Object.keys(designData.views));
    expect(requestGet.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeClientRequest)).to.be.true;
  })));

  it('returns an empty array if no views exist', run(Effect.gen(function* () {
    const fakeClientRequest = { hello: 'world' };
    requestGet.returns(fakeClientRequest);
    const designData = {
      _id: 'medic-client',
    };
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(designData),
    }));

    const service = yield* CouchDesignService;
    const dbInfos = yield* service.getViewNames('medic', designData._id);

    expect(dbInfos).to.deep.equal([]);
    expect(requestGet.calledOnceWithExactly(`/medic/_design/${designData._id}`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(fakeClientRequest)).to.be.true;
  })));
});
