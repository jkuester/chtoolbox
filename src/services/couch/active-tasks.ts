import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

const ENDPOINT = '/_active_tasks';

export class CouchActiveTask extends Schema.Class<CouchActiveTask>('CouchActiveTask')({
  database: Schema.String,
  design_document: Schema.UndefinedOr(Schema.String),
  pid: Schema.String,
  progress: Schema.UndefinedOr(Schema.Number),
  started_on: Schema.Number,
  type: Schema.String,
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchActiveTask));
}

export interface CouchActiveTasksService {
  readonly get: () => Effect.Effect<readonly CouchActiveTask[], Error>
}

export const CouchActiveTasksService = Context.GenericTag<CouchActiveTasksService>('chtoolbox/CouchActiveTasksService');

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchActiveTasksServiceLive = Layer.effect(CouchActiveTasksService, ServiceContext.pipe(Effect.map(
  context => CouchActiveTasksService.of({
    get: () => CouchService.pipe(
      Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
      CouchActiveTask.decodeResponse,
      Effect.provide(context),
    ),
  }),
)));
