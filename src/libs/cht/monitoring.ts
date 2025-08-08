import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { Schema } from 'effect';

const ENDPOINT = '/api/v2/monitoring';

export class ChtMonitoringData extends Schema.Class<ChtMonitoringData>('ChtMonitoringData')({
  version: Schema.Struct({
    app: Schema.String,
    couchdb: Schema.String,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(ChtMonitoringData);
}

export const getChtMonitoringData = (): Effect.Effect<ChtMonitoringData, Error, ChtClientService> => ChtClientService
  .request(HttpClientRequest.get(ENDPOINT))
  .pipe(
    Effect.flatMap(ChtMonitoringData.decodeResponse),
    Effect.scoped,
  );
