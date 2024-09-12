import * as Schema from '@effect/schema/Schema';
import type { HttpBody, HttpClientError } from "@effect/platform"
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from "effect/Effect"
import type * as ParseResult from "@effect/schema/ParseResult"
import * as Context from 'effect/Context';
import * as Layer from "effect/Layer"
import { CouchService, CouchServiceLive } from './couch.service';

const DBS_INFO_REQUEST = HttpClientRequest.get("/_dbs_info");

class DbInfo extends Schema.Class<DbInfo>("DbInfo")({
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
}

class DbsInfo extends Schema.Class<Array<DbInfo>>("DbsInfo")({}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(DbsInfo)
}

interface DbsInfoService {
  readonly get: () => Effect.Effect<DbsInfo, HttpClientError.HttpClientError | HttpBody.HttpBodyError | ParseResult.ParseError>
}

export const DbsInfoService = Context.GenericTag<DbsInfoService>('chtoolbox/DbsInfoService');

const createDbsInfoService = CouchService.pipe(
  Effect.map(couch => DbsInfoService.of({
    get: () => couch
      .request(DBS_INFO_REQUEST)
      .pipe(DbsInfo.decodeResponse)
  })),
);

export const DbsInfoServiceLive = Layer
  .effect(DbsInfoService, createDbsInfoService)
  .pipe(Layer.provide(CouchServiceLive));
