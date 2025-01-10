import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, Schema } from 'effect';
import { ChtClientService } from '../../services/cht-client';
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

export const getAllDbsInfo = (): Effect.Effect<
  readonly CouchDbInfo[], Error, ChtClientService
> => ChtClientService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  Effect.flatMap(CouchDbInfo.decodeResponse),
  Effect.scoped,
);

export const getDbsInfoByName = (
  dbNames: NonEmptyArray<string>
): Effect.Effect<readonly CouchDbInfo[], Error, ChtClientService> => getPostRequest(dbNames)
  .pipe(
    Effect.flatMap(request => ChtClientService.request(request)),
    Effect.flatMap(CouchDbInfo.decodeResponse),
    Effect.scoped,
  );

export const getDbNames = (): Effect.Effect<string[], Error, ChtClientService> => getAllDbsInfo()
  .pipe(Effect.map(Array.map(({ key }) => key)));