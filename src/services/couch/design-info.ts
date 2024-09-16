import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

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
  readonly get: (dbName: string, designName: string) => Effect.Effect<CouchDesignInfo, Error>
}

export const CouchDesignInfoService = Context.GenericTag<CouchDesignInfoService>('chtoolbox/CouchDesignInfoService');

const create = CouchService.pipe(
  Effect.map(couch => CouchDesignInfoService.of({
    get: (dbName, designName) => couch
      .request(HttpClientRequest.get(`/${dbName}/_design/${designName}/_info`))
      .pipe(CouchDesignInfo.decodeResponse)
  })),
);

export const CouchDesignInfoServiceLive = Layer.effect(CouchDesignInfoService, create);
