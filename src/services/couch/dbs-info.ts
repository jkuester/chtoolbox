import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array } from 'effect';
import { CouchService } from './couch';
import { NonEmptyArray } from 'effect/Array';

const ENDPOINT = '/_dbs_info';

const DbsInfoBody = Schema.Struct({ keys: Schema.Array(Schema.String) });
const getPostRequest = (keys: NonEmptyArray<string>) => DbsInfoBody.pipe(
  HttpClientRequest.schemaBody,
  build => build(
    HttpClientRequest.post(ENDPOINT),
    { keys }
  ),
  Effect.mapError(x => x as unknown as Error),
);

export class CouchDbInfo extends Schema.Class<CouchDbInfo>('CouchDbInfo')({
  key: Schema.String,
  info: Schema.Struct({
    db_name: Schema.String,
    update_seq: Schema.String,
    sizes: Schema.Struct({
      file: Schema.Number,
      external: Schema.Number,
      active: Schema.Number,
    }),
    purge_seq: Schema.String,
    doc_del_count: Schema.Number,
    doc_count: Schema.Number,
    disk_format_version: Schema.Number,
    compact_running: Schema.Boolean,
    cluster: Schema.Struct({
      q: Schema.Number,
      n: Schema.Number,
      w: Schema.Number,
      r: Schema.Number,
    }),
    instance_start_time: Schema.String,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchDbInfo));
}

export interface CouchDbsInfoService {
  readonly post: (dbNames: NonEmptyArray<string>) => Effect.Effect<readonly CouchDbInfo[], Error>
  readonly get: () => Effect.Effect<readonly CouchDbInfo[], Error>
  readonly getDbNames: () => Effect.Effect<readonly string[], Error>
}

export const CouchDbsInfoService = Context.GenericTag<CouchDbsInfoService>('chtoolbox/CouchDbsInfoService');

const dbsInfo = CouchService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  CouchDbInfo.decodeResponse,
);

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchDbsInfoServiceLive = Layer.effect(CouchDbsInfoService, ServiceContext.pipe(Effect.map(
  context => CouchDbsInfoService.of({
    post: (dbNames: NonEmptyArray<string>) => Effect
      .all([CouchService, getPostRequest(dbNames)])
      .pipe(
        Effect.flatMap(([couch, request]) => couch.request(request)),
        CouchDbInfo.decodeResponse,
        Effect.provide(context),
      ),
    get: () => dbsInfo.pipe(Effect.provide(context)),
    getDbNames: () => dbsInfo.pipe(
      Effect.map(Array.map(x => x.key)),
      Effect.provide(context),
    )
  })
)));
