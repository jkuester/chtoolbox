import { Schema } from 'effect';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { ChtClientService } from '../cht-client';

export class NouveauInfo extends Schema.Class<NouveauInfo>('NouveauInfo')({
  name: Schema.String,
  search_index: Schema.Struct({
    update_seq: Schema.Number,
    purge_seq: Schema.Number,
    num_docs: Schema.Number,
    disk_size: Schema.Number,
  }),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(NouveauInfo);
}

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class NouveauInfoService extends Effect.Service<NouveauInfoService>()(
  'chtoolbox/NouveauInfoService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      get: (dbName: string, ddocName: string, indexName: string): Effect.Effect<NouveauInfo, Error> => ChtClientService
        .request(HttpClientRequest.get(`/${dbName}/_design/${ddocName}/_nouveau_info/${indexName}`))
        .pipe(
          Effect.flatMap(NouveauInfo.decodeResponse),
          Effect.scoped,
          Effect.provide(context),
        )
    }))),
    accessors: true,
  }
) {
}
