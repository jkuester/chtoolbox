import * as Schema from '@effect/schema/Schema';
import type { HttpBody, HttpClientError } from "@effect/platform"
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from "effect/Effect"
import type * as ParseResult from "@effect/schema/ParseResult"
import * as Context from 'effect/Context';
import * as Layer from "effect/Layer"
import { CouchService, CouchServiceLive } from './couch';

const NODE_SYSTEM_REQUEST = HttpClientRequest.get("/_node/_local/_system");

export class CouchNodeSystem extends Schema.Class<CouchNodeSystem>("CouchNodeSystem")({
  memory: Schema.Struct({
    other: Schema.Number,
    atom: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchNodeSystem)
}

interface CouchNodeSystemService {
  readonly get: () => Effect.Effect<CouchNodeSystem, Error>
}

export const CouchNodeSystemService = Context.GenericTag<CouchNodeSystemService>("chtoolbox/CouchNodeSystemService");

const createCouchNodeSystemService = CouchService.pipe(
  Effect.map(couch => CouchNodeSystemService.of({
    get: () => couch
      .request(NODE_SYSTEM_REQUEST)
      .pipe(CouchNodeSystem.decodeResponse)
  })),
);

export const CouchNodeSystemServiceLive = Layer
  .effect(CouchNodeSystemService, createCouchNodeSystemService)
  .pipe(Layer.provide(CouchServiceLive));
