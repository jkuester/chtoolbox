import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.js';
import * as NouveauInfoLibs from '../../../src/libs/couch/nouveau-info.js';
import { createNouveauInfo } from '../../utils/data-models.js';
import { genWithLayer, sandbox } from '../../utils/base.js';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getNouveauInfo } = await esmock<typeof NouveauInfoLibs>('../../../src/libs/couch/nouveau-info.js', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Nouveau Index Info libs', () => {
  [
    createNouveauInfo({
      name: '_design/medic/contacts_by_freetext',
      update_seq: 123,
      purge_seq: 456,
      num_docs: 789,
      disk_size: 1024,
    }),
    createNouveauInfo(),
  ].forEach(expectedNouveauInfo => {
    it('gets design info for a database', run(function* () {
      const dbName = 'medic';
      const ddocName = 'medicddoc';
      const indexName = 'contacts_by_freetext';
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed(expectedNouveauInfo),
      }));

      const nouveauInfo = yield* getNouveauInfo(dbName, ddocName, indexName);

      expect(nouveauInfo).to.deep.equal(expectedNouveauInfo);
      expect(mockHttpRequest.get.calledOnceWithExactly(`/${dbName}/_design/${ddocName}/_nouveau_info/${indexName}`)).to.be.true;
      expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    }));
  });
});
