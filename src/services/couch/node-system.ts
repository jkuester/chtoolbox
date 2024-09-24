import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

const ENDPOINT = '/_node/_local/_system';

export class CouchNodeSystem extends Schema.Class<CouchNodeSystem>('CouchNodeSystem')({
  memory: Schema.Struct({
    processes_used: Schema.Number,
    binary: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchNodeSystem);
}

export interface CouchNodeSystemService {
  readonly get: () => Effect.Effect<CouchNodeSystem, Error>
}

export const CouchNodeSystemService = Context.GenericTag<CouchNodeSystemService>('chtoolbox/CouchNodeSystemService');

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchNodeSystemServiceLive = Layer.effect(CouchNodeSystemService, ServiceContext.pipe(Effect.map(
  context => CouchNodeSystemService.of({
    get: () => CouchService.pipe(
      Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
      CouchNodeSystem.decodeResponse,
      Effect.provide(context),
    ),
  }),
)));
