import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array } from 'effect';
import { CouchService } from './couch';

const ENDPOINT = '/_dbs_info';

const DbsInfoBody = Schema.Struct({ keys: Schema.Array(Schema.String) });
const getPostRequest = () => DbsInfoBody.pipe(
  HttpClientRequest.schemaBody,
  build => build(
    HttpClientRequest.post(ENDPOINT),
    { keys: ['medic', 'medic-sentinel', 'medic-users-meta', '_users'] }
  ),
);

export class CouchDbInfo extends Schema.Class<CouchDbInfo>('CouchDbInfo')({
  key: Schema.String,
  info: Schema.Struct({
    compact_running: Schema.Boolean,
    sizes: Schema.Struct({
      file: Schema.Number,
      active: Schema.Number,
    }),
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchDbInfo));
}

export interface CouchDbsInfoService {
  readonly post: () => Effect.Effect<readonly CouchDbInfo[], Error>
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
    post: () => Effect
      .all([CouchService, getPostRequest()])
      .pipe(
        Effect.flatMap(([couch, request]) => couch.request(request)),
        CouchDbInfo.decodeResponse,
        Effect.mapError(x => x as Error),
        Effect.provide(context),
      ),
    get: () => dbsInfo.pipe(Effect.provide(context)),
    getDbNames: () => dbsInfo.pipe(
      Effect.map(Array.map(x => x.key)),
      Effect.provide(context),
    )
  })
)));
