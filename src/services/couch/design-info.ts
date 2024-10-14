import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

export class CouchDesignInfo extends Schema.Class<CouchDesignInfo>('CouchDesignInfo')({
  name: Schema.String,
  view_index: Schema.Struct({
    collator_versions: Schema.Array(Schema.String),
    compact_running: Schema.Boolean,
    language: Schema.String,
    purge_seq: Schema.Number,
    signature: Schema.String,
    sizes: Schema.Struct({
      active: Schema.Number,
      external: Schema.Number,
      file: Schema.Number,
    }),
    updater_running: Schema.Boolean,
    updates_pending: Schema.Struct({
      minimum: Schema.Number,
      preferred: Schema.Number,
      total: Schema.Number,
    }),
    waiting_commit: Schema.Boolean,
    waiting_clients: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignInfo);
}

export interface CouchDesignInfoService {
  readonly get: (dbName: string, designName: string) => Effect.Effect<CouchDesignInfo, Error>
}

export const CouchDesignInfoService = Context.GenericTag<CouchDesignInfoService>('chtoolbox/CouchDesignInfoService');

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchDesignInfoServiceLive = Layer.effect(CouchDesignInfoService, ServiceContext.pipe(Effect.map(
  context => CouchDesignInfoService.of({
    get: (dbName: string, designName: string) => CouchService.pipe(
      Effect.flatMap(couch => couch.request(HttpClientRequest.get(`/${dbName}/_design/${designName}/_info`))),
      Effect.flatMap(CouchDesignInfo.decodeResponse),
      Effect.scoped,
      Effect.provide(context),
    )
  })
)));
