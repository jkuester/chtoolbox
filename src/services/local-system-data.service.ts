import * as Schema from '@effect/schema/Schema';
import type { HttpBody, HttpClientError } from "@effect/platform"
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from "effect/Effect"
import type * as ParseResult from "@effect/schema/ParseResult"
import * as Context from 'effect/Context';
import * as Layer from "effect/Layer"
import { CouchService, CouchServiceLive } from './couch.service';

const LOCAL_SYSTEM_REQUEST = HttpClientRequest.get("/_node/_local/_system");

class LocalSystemData extends Schema.Class<LocalSystemData>("LocalSystemData")({
  memory: Schema.Struct({
    other: Schema.Number,
    atom: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(LocalSystemData)
}

interface LocalSystemDataService {
  readonly get: () => Effect.Effect<LocalSystemData, HttpClientError.HttpClientError | HttpBody.HttpBodyError | ParseResult.ParseError>
}

export const LocalSystemDataService = Context.GenericTag<LocalSystemDataService>("chtoolbox/LocalSystemDataService");

const createCouchSystemService = CouchService.pipe(
  Effect.map(couch => LocalSystemDataService.of({
    get: () => couch
      .request(LOCAL_SYSTEM_REQUEST)
      .pipe(LocalSystemData.decodeResponse)
  })),
);

export const LocalSystemDataServiceLive = Layer
  .effect(LocalSystemDataService, createCouchSystemService)
  .pipe(Layer.provide(CouchServiceLive));
