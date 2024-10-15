import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CouchService } from '../../../src/services/couch/couch';
import { HttpClientRequest } from '@effect/platform';
import { CouchDesignInfoService } from '../../../src/services/couch/design-info';
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
      Effect.provide(CouchDesignInfoService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchService, {
        request: couchRequest,
      } as unknown as CouchService)),
    ));
  };

  [
    createDesignInfo({
      name: 'medic-client',
      collator_versions: ['153.104', '1222.121214'],
      compact_running: true,
      language: 'javascript',
      purge_seq: 123,
      signature: 'c87f8fefeb37cdcd27e9e06ba6a89059',
      active: 234,
      external: 345,
      file: 123,
      updater_running: true,
      minimum: 1,
      preferred: 2,
      total: 3,
      waiting_commit: true,
      waiting_clients: 4,
    }),
    createDesignInfo(),
  ].forEach(expectedDesignInfo => {
    it('gets design info for a database', run(Effect.gen(function* () {
      const db = 'medic';
      requestGet.returns(FAKE_CLIENT_REQUEST);
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed(expectedDesignInfo),
      }));

      const service = yield* CouchDesignInfoService;
      const designInfo = yield* service.get(db, expectedDesignInfo.name);

      expect(designInfo).to.deep.equal(expectedDesignInfo);
      expect(requestGet.calledOnceWithExactly(`/${db}/_design/${expectedDesignInfo.name}/_info`)).to.be.true;
      expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    })));
  });
});
