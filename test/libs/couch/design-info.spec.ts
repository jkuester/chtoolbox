import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as DesignInfoLibs from '../../../src/libs/couch/design-info.ts';
import { createDesignInfo } from '../../utils/data-models.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getDesignInfo } = await esmock<typeof DesignInfoLibs>('../../../src/libs/couch/design-info.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Design Info libs', () => {
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
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed(expectedDesignInfo),
      }));

      const designInfo = yield* getDesignInfo(db, expectedDesignInfo.name);

      expect(designInfo).to.deep.equal(expectedDesignInfo);
      expect(mockHttpRequest.get.calledOnceWithExactly(`/${db}/_design/${expectedDesignInfo.name}/_info`)).to.be.true;
      expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    }));
  });
});
