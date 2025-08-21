import * as Effect from 'effect/Effect';
import { Array, pipe, Schema } from 'effect';
import { ChtClientService } from '../../services/cht-client.ts';
import type { NonEmptyArray } from 'effect/Array';
import { buildPostRequest } from '../http-client.ts';

type RemoveDocument = PouchDB.Core.RemoveDocument;

const PurgeBody = Schema.Record({
  key: Schema.String,
  value: Schema.Array(Schema.String)
});

const purgeDb = (dbName: string) => Effect.fn((body: typeof PurgeBody.Type) => pipe(
  body,
  buildPostRequest(`/${dbName}/_purge`, PurgeBody),
  Effect.flatMap(ChtClientService.request),
  Effect.scoped,
));

const purgeDocs = Effect.fn((
  dbName: string,
  docs: Readonly<NonEmptyArray<RemoveDocument>>
) => pipe(
  docs,
  Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })),
  purgeDb(dbName),
));

export const purgeFrom = (
  dbName: string
): (docs: Readonly<NonEmptyArray<RemoveDocument>>) => ReturnType<typeof purgeDocs> => (
  docs
) => purgeDocs(dbName, docs);
