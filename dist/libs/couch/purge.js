import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from "../../services/cht-client.js";
const PurgeBody = Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) });
const getPostRequest = Effect.fn((dbName, body) => PurgeBody.pipe(HttpClientRequest.schemaBodyJson, build => build(HttpClientRequest.post(`/${dbName}/_purge`), body), Effect.mapError(x => x)));
const purgeDb = (dbName) => Effect.fn((body) => getPostRequest(dbName, body), Effect.flatMap(ChtClientService.request), Effect.scoped);
const purgeDocs = Effect.fn((dbName, docs) => pipe(docs, Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })), purgeDb(dbName)));
export const purgeFrom = (dbName) => Effect.fn((docs) => purgeDocs(dbName, docs));
