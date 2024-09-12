import * as Schema from '@effect/schema/Schema';
import type { HttpBody, HttpClientError } from "@effect/platform"
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from "effect/Effect"
import type * as ParseResult from "@effect/schema/ParseResult"
import * as Context from 'effect/Context';
import * as Layer from "effect/Layer"
import { CouchService, CouchServiceLive } from './couch';

const DBS_INFO_REQUEST = HttpClientRequest.get("/_dbs_info");

class CouchDbInfo extends Schema.Class<CouchDbInfo>("CouchDbInfo")({
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

class CouchDbsInfo extends Schema.Class<Array<CouchDbInfo>>("CouchDbsInfo")({}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchDbsInfo)
}

interface CouchDbsInfoService {
  readonly get: () => Effect.Effect<CouchDbsInfo, Error>
}

export const CouchDbsInfoService = Context.GenericTag<CouchDbsInfoService>('chtoolbox/CouchDbsInfoService');

const createDbsInfoService = CouchService.pipe(
  Effect.map(couch => CouchDbsInfoService.of({
    get: () => couch
      .request(DBS_INFO_REQUEST)
      .pipe(CouchDbsInfo.decodeResponse)
  })),
);

export const CouchDbsInfoServiceLive = Layer
  .effect(CouchDbsInfoService, createDbsInfoService)
  .pipe(Layer.provide(CouchServiceLive));
