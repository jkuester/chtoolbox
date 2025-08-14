import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { pipe, Schema } from 'effect';

const ENDPOINT = '/api/v2/monitoring';

class ChtMonitoringData extends Schema.Class<ChtMonitoringData>('ChtMonitoringData')({
  version: Schema.Struct({
    app: Schema.String,
    couchdb: Schema.String,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(ChtMonitoringData);
}

const requestMonitoringData = Effect.fn(() => pipe(
  ENDPOINT,
  HttpClientRequest.get,
  ChtClientService.request
));

export const chtMonitoringDataEffect = Effect
  .suspend(requestMonitoringData)
  .pipe(
    Effect.flatMap(ChtMonitoringData.decodeResponse),
    Effect.scoped,
  );
