import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from '../../services/cht-client.ts';
import type { NonEmptyArray } from 'effect/Array';
import { buildPostRequest } from '../http-client.js';

const ENDPOINT = '/_dbs_info';

const DbsInfoBody = Schema.Struct({
  keys: Schema.Array(Schema.String)
});

const getPostRequest = Effect.fn((keys: NonEmptyArray<string>) => pipe(
  { keys },
  buildPostRequest(ENDPOINT, DbsInfoBody)
));

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
  static readonly decodeResponse = Schema.Array(CouchDbInfo).pipe(HttpClientResponse.schemaBodyJson);
}

export const allDbsInfoEffect = Effect.suspend(() => pipe(
  HttpClientRequest.get(ENDPOINT),
  ChtClientService.request,
  Effect.flatMap(CouchDbInfo.decodeResponse),
  Effect.scoped,
));

export const getDbsInfoByName = Effect.fn((
  dbNames: NonEmptyArray<string>
) => getPostRequest(dbNames)
  .pipe(
    Effect.flatMap(request => ChtClientService.request(request)),
    Effect.flatMap(CouchDbInfo.decodeResponse),
    Effect.scoped,
  ));

export const getDbNames = Effect.fn((): Effect.Effect<string[], Error, ChtClientService> => allDbsInfoEffect
  .pipe(Effect.map(Array.map(({ key }) => key))));
