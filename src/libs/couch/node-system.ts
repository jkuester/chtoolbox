import { Schema } from 'effect';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';

const ENDPOINT = '/_node/_local/_system';

export class CouchNodeSystem extends Schema.Class<CouchNodeSystem>('CouchNodeSystem')({
  memory: Schema.Struct({
    processes_used: Schema.Number,
    binary: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchNodeSystem);
}

export const getCouchNodeSystem = (): Effect.Effect<CouchNodeSystem, Error, ChtClientService> => ChtClientService
  .request(HttpClientRequest.get(ENDPOINT))
  .pipe(
    Effect.flatMap(CouchNodeSystem.decodeResponse),
    Effect.scoped,
  );
