import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array } from 'effect';
import { CouchResponseEffect, CouchService } from './couch';

const ENDPOINT = '/_dbs_info';

const DbsInfoBody = Schema.Struct({ keys: Schema.Array(Schema.String) });
const DBS_INFO_REQUEST = DbsInfoBody.pipe(
  HttpClientRequest.schemaBody,
  build => build(
    HttpClientRequest.post(ENDPOINT),
    { keys: ['medic', 'medic-sentinel', 'medic-users-meta', '_users'] }
  ),
);

export class CouchDbInfo extends Schema.Class<CouchDbInfo>('CouchDbInfo')({
  key: Schema.String,
  info: Schema.Struct({
    compact_running: Schema.Boolean,
    sizes: Schema.Struct({
      file: Schema.Number,
      active: Schema.Number,
    }),
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchDbInfo));
}

export interface CouchDbsInfoService {
  readonly post: () => CouchResponseEffect<readonly CouchDbInfo[]>
  readonly get: () => CouchResponseEffect<readonly CouchDbInfo[]>
  readonly getDbNames: () => CouchResponseEffect<readonly string[]>
}

export const CouchDbsInfoService = Context.GenericTag<CouchDbsInfoService>('chtoolbox/CouchDbsInfoService');

const dbsInfo = CouchService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  CouchDbInfo.decodeResponse,
);

export const CouchDbsInfoServiceLive = Layer.succeed(CouchDbsInfoService, CouchDbsInfoService.of({
  post: () => Effect
    .all([CouchService, DBS_INFO_REQUEST])
    .pipe(
      Effect.flatMap(([couch, request]) => couch.request(request)),
      CouchDbInfo.decodeResponse,
      Effect.mapError(x => x as Error),
    ),
  get: () => dbsInfo,
  getDbNames: () => dbsInfo.pipe(Effect.map(Array.map(x => x.key)))
}));
