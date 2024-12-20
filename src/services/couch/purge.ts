import { HttpClientRequest } from '@effect/platform';
import { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from '../cht-client';
import { NonEmptyArray } from 'effect/Array';
import { HttpClientResponseEffect } from '../../libs/core';
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

const purge = (dbName: string) => (body: typeof PurgeBody.Type) => getPostRequest(dbName, body)
  .pipe(
    Effect.flatMap(ChtClientService.request),
    Effect.scoped,
  );

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class CouchPurgeService extends Effect.Service<CouchPurgeService>()('chtoolbox/CouchPurgeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    purge: (dbName: string, docs: NonEmptyArray<RemoveDocument>): HttpClientResponseEffect => pipe(
      docs,
      Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })),
      purge(dbName),
      Effect.provide(context),
    ),
  }))),
  accessors: true,
}) {
}

export const purgeFrom = (dbName: string) => (
  docs: NonEmptyArray<RemoveDocument>
): Effect.Effect<HttpClientResponse, Error, CouchPurgeService> => CouchPurgeService.purge(dbName, docs);
