import { Schema } from 'effect';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
export class NouveauInfo extends Schema.Class('NouveauInfo')({
    name: Schema.String,
    search_index: Schema.Struct({
        update_seq: Schema.Number,
        purge_seq: Schema.Number,
        num_docs: Schema.Number,
        disk_size: Schema.Number,
    }),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(NouveauInfo);
}
export const getNouveauInfo = Effect.fn((dbName, ddocName, indexName) => ChtClientService
    .request(HttpClientRequest.get(`/${dbName}/_design/${ddocName}/_nouveau_info/${indexName}`))
    .pipe(Effect.flatMap(NouveauInfo.decodeResponse), Effect.scoped));
