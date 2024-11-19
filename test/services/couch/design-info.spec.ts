import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { CouchDesignInfoService } from '../../../src/services/couch/design-info';
import { createDesignInfo } from '../../utils/data-models';
import { genWithLayer, sandbox } from '../../utils/base';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();

const run = CouchDesignInfoService.Default.pipe(
  Layer.provide(Layer.succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)),
  genWithLayer,
);

describe('Couch Design Info Service', () => {
  let requestGet: SinonStub;

  beforeEach(() => {
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

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
    it('gets design info for a database', run(function* () {
      const db = 'medic';
      requestGet.returns(FAKE_CLIENT_REQUEST);
      couchRequest.returns(Effect.succeed({
        json: Effect.succeed(expectedDesignInfo),
      }));

      const designInfo = yield* CouchDesignInfoService.get(db, expectedDesignInfo.name);

      expect(designInfo).to.deep.equal(expectedDesignInfo);
      expect(requestGet.calledOnceWithExactly(`/${db}/_design/${expectedDesignInfo.name}/_info`)).to.be.true;
      expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    }));
  });
});
