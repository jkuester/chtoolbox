import { Schema } from 'effect';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';
export class CouchDesignInfo extends Schema.Class('CouchDesignInfo')({
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
    static decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignInfo);
}
export const getDesignInfo = (dbName, designName) => ChtClientService
    .request(HttpClientRequest.get(`/${dbName}/_design/${designName}/_info`))
    .pipe(Effect.flatMap(CouchDesignInfo.decodeResponse), Effect.scoped);
//# sourceMappingURL=design-info.js.map