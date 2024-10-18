import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { CouchService } from './couch';

const ENDPOINT = '/_node/_local/_system';

export class CouchNodeSystem extends Schema.Class<CouchNodeSystem>('CouchNodeSystem')({
  memory: Schema.Struct({
    processes_used: Schema.Number,
    binary: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchNodeSystem);
}

const serviceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export class CouchNodeSystemService extends Effect.Service<CouchNodeSystemService>()(
  'chtoolbox/CouchNodeSystemService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      get: () => CouchService
        .request(HttpClientRequest.get(ENDPOINT))
        .pipe(
          Effect.flatMap(CouchNodeSystem.decodeResponse),
          Effect.scoped,
          Effect.provide(context),
        ),
    }))),
    accessors: true,
  }
) {
}
