import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Schema } from 'effect';
import { ChtClientService } from '../cht-client';
import { NonEmptyArray } from 'effect/Array';

const ENDPOINT = '/_dbs_info';

const DbsInfoBody = Schema.Struct({ keys: Schema.Array(Schema.String) });
const getPostRequest = (keys: NonEmptyArray<string>) => DbsInfoBody.pipe(
  HttpClientRequest.schemaBodyJson,
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
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(Schema.Array(CouchDbInfo));
}

const dbsInfo = ChtClientService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  Effect.flatMap(CouchDbInfo.decodeResponse),
  Effect.scoped,
);

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class CouchDbsInfoService extends Effect.Service<CouchDbsInfoService>()('chtoolbox/CouchDbsInfoService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    post: (dbNames: NonEmptyArray<string>): Effect.Effect<readonly CouchDbInfo[], Error> => getPostRequest(dbNames)
      .pipe(
        Effect.flatMap(request => ChtClientService.request(request)),
        Effect.flatMap(CouchDbInfo.decodeResponse),
        Effect.scoped,
        Effect.provide(context),
      ),
    get: (): Effect.Effect<readonly CouchDbInfo[], Error> => dbsInfo.pipe(Effect.provide(context)),
    getDbNames: (): Effect.Effect<string[], Error> => dbsInfo.pipe(
      Effect.map(Array.map(x => x.key)),
      Effect.provide(context),
    )
  }))),
  accessors: true,
}) {
}
