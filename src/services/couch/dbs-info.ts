import * as Schema from '@effect/schema/Schema';
import type { HttpBody } from '@effect/platform';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService, CouchServiceLive } from './couch';

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
    db_name: Schema.String,
    sizes: Schema.Struct({
      file: Schema.Number,
      active: Schema.Number,
    }),
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchDbInfo));
}

export interface CouchDbsInfoService {
  readonly get: () => Effect.Effect<readonly CouchDbInfo[], HttpBody.HttpBodyError | Error>
}

export const CouchDbsInfoService = Context.GenericTag<CouchDbsInfoService>('chtoolbox/CouchDbsInfoService');

const createDbsInfoService = CouchService.pipe(
  Effect.map(couch => CouchDbsInfoService.of({
    get: () => DBS_INFO_REQUEST.pipe(
      Effect.flatMap(request => couch.request(request)),
      CouchDbInfo.decodeResponse
    )
  })),
);

export const CouchDbsInfoServiceLive = Layer
  .effect(CouchDbsInfoService, createDbsInfoService)
  .pipe(Layer.provide(CouchServiceLive));
