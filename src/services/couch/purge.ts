import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, pipe } from 'effect';
import { CouchService } from './couch';
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

const purge = (dbName: string) => (body: typeof PurgeBody.Type) => getPostRequest(dbName, body)
  .pipe(
    Effect.flatMap(CouchService.request),
    Effect.scoped,
  );

const serviceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export class CouchPurgeService extends Effect.Service<CouchPurgeService>()('chtoolbox/CouchPurgeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    purge: (dbName: string, docs: NonEmptyArray<RemoveDocument>) => pipe(
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
) => CouchPurgeService.purge(dbName, docs);
