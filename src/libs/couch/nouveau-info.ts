import { pipe, Schema } from 'effect';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';

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

export const getNouveauInfo = Effect.fn((
  dbName: string,
  ddocName: string,
  indexName: string
) => pipe(
  HttpClientRequest.get(`/${dbName}/_design/${ddocName}/_nouveau_info/${indexName}`),
  ChtClientService.request,
  Effect.flatMap(NouveauInfo.decodeResponse),
  Effect.scoped,
));
