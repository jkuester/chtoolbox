import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.js';
import * as MonitoringLibs from '../../../src/libs/cht/monitoring.js';
import { createChtMonitoringData } from '../../utils/data-models.js';
import { genWithLayer, sandbox } from '../../utils/base.js';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getChtMonitoringData } = await esmock<typeof MonitoringLibs>('../../../src/libs/cht/monitoring.js', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('CHT Monitoring libs', () => {
  [
    createChtMonitoringData({
      versionApp: 'app-version',
      versionCouchDb: 'couchdb-version',
    }),
    createChtMonitoringData(),
  ].forEach(expectedChtMonitoringData => {
    it('gets monitoring data for CHT instance', run(function* () {
      mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
      mockChtClient.request.returns(Effect.succeed({
        json: Effect.succeed(expectedChtMonitoringData),
      }));

      const monitoringData = yield* getChtMonitoringData();

      expect(monitoringData).to.deep.equal(expectedChtMonitoringData);
      expect(mockHttpRequest.get.calledOnceWithExactly('/api/v2/monitoring')).to.be.true;
      expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
    }));
  });
});
