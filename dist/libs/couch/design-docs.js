import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, Schema } from 'effect';
import { ChtClientService } from "../../services/cht-client.js";
class CouchDesignDocs extends Schema.Class('CouchDesignDocs')({
    rows: Schema.Array(Schema.Struct({
        id: Schema.String,
    })),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignDocs);
}
export const getDesignDocNames = (dbName) => ChtClientService
    .request(HttpClientRequest.get(`/${dbName}/_design_docs`))
    .pipe(Effect.flatMap(CouchDesignDocs.decodeResponse), Effect.scoped, Effect.map(designDocs => designDocs.rows), Effect.map(Array.map(({ id }) => id)), Effect.map(Array.map(id => id.split('/')[1])));
//# sourceMappingURL=design-docs.js.map