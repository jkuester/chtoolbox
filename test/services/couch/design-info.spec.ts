import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchDesignInfoService, CouchDesignInfoServiceLive } from '../../../src/services/couch/design-info';
import { createDesignInfo } from '../../utils/data-models';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch Design Info Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchDesignInfoService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchDesignInfoServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, CouchService.of({
        request: couchRequest,
      }))),
    ));
  };

  it('gets design names for a database', run(Effect.gen(function* () {
    const db = 'medic';
    const design = 'medic-client';
    requestGet.returns(FAKE_CLIENT_REQUEST);
    const medicClientDesignInfo = createDesignInfo({
      name: design,
      compact_running: true,
      updater_running: true,
      file: 123,
      active: 234
    });
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed(medicClientDesignInfo),
    }));

    const service = yield* CouchDesignInfoService;
    const designInfo = yield* service.get(db, design);

    expect(designInfo).to.deep.equal(medicClientDesignInfo);
    expect(requestGet.calledOnceWithExactly(`/${db}/_design/${design}/_info`)).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));
});
