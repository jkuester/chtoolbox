import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, pipe, Schema, String } from 'effect';
import { ChtClientService } from "../../services/cht-client.js";
class CouchDesignDocs extends Schema.Class('CouchDesignDocs')({
    rows: Schema.Array(Schema.Struct({
        id: Schema.String,
    })),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignDocs);
}
const getDdocNameFromId = ({ id }) => pipe(id, String.split('/'), ([, name]) => name, Effect.fromNullable);
export const getDesignDocNames = Effect.fn((dbName) => pipe(HttpClientRequest.get(`/${dbName}/_design_docs`), ChtClientService.request, Effect.flatMap(CouchDesignDocs.decodeResponse), Effect.scoped, Effect.map(designDocs => designDocs.rows), Effect.map(Array.map(getDdocNameFromId)), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' }))));
