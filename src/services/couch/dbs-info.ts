import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect, CouchService } from './couch';

const DbsInfoBody = Schema.Struct({ keys: Schema.Array(Schema.String) });

const DBS_INFO_REQUEST = DbsInfoBody.pipe(
  HttpClientRequest.schemaBody,
  build => build(
    HttpClientRequest.post('/_dbs_info'),
    { keys: ['medic', 'medic-sentinel', 'medic-users-meta', '_users'] }
  )
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
  readonly get: () => CouchResponseEffect<readonly CouchDbInfo[]>
}

export const CouchDbsInfoService = Context.GenericTag<CouchDbsInfoService>('chtoolbox/CouchDbsInfoService');

export const CouchDbsInfoServiceLive = Layer.succeed(CouchDbsInfoService, CouchDbsInfoService.of({
  get: () => Effect
    .all([CouchService, DBS_INFO_REQUEST])
    .pipe(
      Effect.flatMap(([couch, request]) => couch.request(request)),
      CouchDbInfo.decodeResponse,
      Effect.mapError(x => x as Error),
    )
}));
