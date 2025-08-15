import * as Effect from 'effect/Effect';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from "../../services/cht-client.js";
import { buildPostRequest } from '../http-client.js';
const PurgeBody = Schema.Record({
    key: Schema.String,
    value: Schema.Array(Schema.String)
});
const purgeDb = (dbName) => Effect.fn((body) => pipe(body, buildPostRequest(`/${dbName}/_purge`, PurgeBody), Effect.flatMap(ChtClientService.request), Effect.scoped));
const purgeDocs = Effect.fn((dbName, docs) => pipe(docs, Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })), purgeDb(dbName)));
export const purgeFrom = (dbName) => (docs) => purgeDocs(dbName, docs);
