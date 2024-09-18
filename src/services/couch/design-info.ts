import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect, CouchService } from './couch';

export class CouchDesignInfo extends Schema.Class<CouchDesignInfo>('DesignInfo')({
  name: Schema.String,
  view_index: Schema.Struct({
    compact_running: Schema.Boolean,
    updater_running: Schema.Boolean,
    sizes: Schema.Struct({
      file: Schema.Number,
      active: Schema.Number,
    }),
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchDesignInfo);
}

export interface CouchDesignInfoService {
  readonly get: (dbName: string, designName: string) => CouchResponseEffect<CouchDesignInfo>
}

export const CouchDesignInfoService = Context.GenericTag<CouchDesignInfoService>('chtoolbox/CouchDesignInfoService');

export const CouchDesignInfoServiceLive = Layer.succeed(CouchDesignInfoService, CouchDesignInfoService.of({
  get: (dbName: string, designName: string) => CouchService.pipe(
    Effect.flatMap(couch => couch.request(HttpClientRequest.get(`/${dbName}/_design/${designName}/_info`))),
    CouchDesignInfo.decodeResponse,
  )
}));
