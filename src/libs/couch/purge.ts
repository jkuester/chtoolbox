import { HttpClientRequest } from '@effect/platform';
import { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from '../../services/cht-client';
import { NonEmptyArray } from 'effect/Array';
import RemoveDocument = PouchDB.Core.RemoveDocument;

const PurgeBody = Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) });
const getPostRequest = (dbName: string, body: typeof PurgeBody.Type) => PurgeBody.pipe(
  HttpClientRequest.schemaBodyJson,
  build => build(
    HttpClientRequest.post(`/${dbName}/_purge`),
    body
  ),
  Effect.mapError(x => x as unknown as Error),
);

const purgeDb = (dbName: string) => (body: typeof PurgeBody.Type) => getPostRequest(dbName, body)
  .pipe(
    Effect.flatMap(ChtClientService.request),
    Effect.scoped,
  );

const purgeDocs = (
  dbName: string,
  docs: NonEmptyArray<RemoveDocument>
): Effect.Effect<HttpClientResponse, Error, ChtClientService> => pipe(
  docs,
  Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })),
  purgeDb(dbName),
);

export const purgeFrom = (dbName: string) => (
  docs: NonEmptyArray<RemoveDocument>
): Effect.Effect<HttpClientResponse, Error, ChtClientService> => purgeDocs(dbName, docs);
