import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, Schema, String, Predicate } from 'effect';
import { ChtClientService } from "../../services/cht-client.js";
class CouchDesignDocs extends Schema.Class('CouchDesignDocs')({
    rows: Schema.Array(Schema.Struct({
        id: Schema.String,
    })),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignDocs);
}
export const getDesignDocNames = Effect.fn((dbName) => ChtClientService
    .request(HttpClientRequest.get(`/${dbName}/_design_docs`))
    .pipe(Effect.flatMap(CouchDesignDocs.decodeResponse), Effect.scoped, Effect.map(designDocs => designDocs.rows), Effect.map(Array.map(({ id }) => id)), Effect.map(Array.map(String.split('/'))), Effect.map(Array.map(([, name]) => name)), Effect.filterOrFail((names) => Array.every(names, Predicate.isNotNullable))));
