import { HttpClientRequest } from '@effect/platform';
import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from '../../services/cht-client.ts';
import type { NonEmptyArray } from 'effect/Array';
type RemoveDocument = PouchDB.Core.RemoveDocument;

const PurgeBody = Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) });
const getPostRequest = Effect.fn((dbName: string, body: typeof PurgeBody.Type) => PurgeBody.pipe(
  HttpClientRequest.schemaBodyJson,
  build => build(
    HttpClientRequest.post(`/${dbName}/_purge`),
    body
  ),
  Effect.mapError(x => x as unknown as Error),
));

const purgeDb = (dbName: string) => Effect.fn(
  (body: typeof PurgeBody.Type) => getPostRequest(dbName, body),
  Effect.flatMap(ChtClientService.request),
  Effect.scoped,
);

const purgeDocs = Effect.fn((
  dbName: string,
  docs: Readonly<NonEmptyArray<RemoveDocument>>
): Effect.Effect<HttpClientResponse, Error, ChtClientService> => pipe(
  docs,
  Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })),
  purgeDb(dbName),
));

export const purgeFrom = (
  dbName: string
): (
  docs: Readonly<NonEmptyArray<RemoveDocument>>
) => Effect.Effect<HttpClientResponse, Error, ChtClientService> => Effect.fn((docs) => purgeDocs(dbName, docs));
