import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Option, pipe, Redacted, Stream } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import { EnvironmentService } from './environment';

PouchDB.plugin(PouchDBAdapterHttp);
PouchDB.plugin(PouchDBSessionAuthentication);

const isPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): value is PouchDB.Core.Response => 'ok' in value && value.ok;

export const assertPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): PouchDB.Core.Response => pipe(
  Option.liftPredicate(value, isPouchResponse),
  Option.getOrThrowWith(() => value),
);

const getAllDocsPage = (
  db: PouchDB.Database,
  options: PouchDB.Core.AllDocsWithKeyOptions |
    PouchDB.Core.AllDocsWithinRangeOptions |
    PouchDB.Core.AllDocsOptions
) => (
  skip: number
): Effect.Effect<[PouchDB.Core.AllDocsResponse<object>, Option.Option<number>]> => Effect
  .promise(() => db.allDocs({ skip, ...options }))
  .pipe(
    Effect.map((response) => [
      response,
      pipe(
        skip + (options.limit ?? 1000),
        Option.liftPredicate(() => response.rows.length === options.limit),
      )
    ])
  );

export const streamAllDocPages = (
  options: PouchDB.Core.AllDocsWithKeyOptions |
    PouchDB.Core.AllDocsWithinRangeOptions |
    PouchDB.Core.AllDocsOptions = {}
) => (db: PouchDB.Database) => pipe(
  getAllDocsPage(db, { limit: 1000, ...options }),
  pageFn => Stream.paginateEffect(0, pageFn),
);

const couchUrl = EnvironmentService
  .get()
  .pipe(Effect.map(({ url }) => url));

const getPouchDB = (dbName: string) => couchUrl.pipe(Effect.map(url => pouchDB(`${Redacted.value(url)}${dbName}`)));

const serviceContext = EnvironmentService.pipe(Effect.map(env => Context.make(EnvironmentService, env)));

export class PouchDBService extends Effect.Service<PouchDBService>()('chtoolbox/PouchDBService', {
  effect: Effect
    .all([
      serviceContext,
      Effect.cachedFunction(getPouchDB),
    ])
    .pipe(Effect.map(([context, memoizedGetPouchDb]) => ({
      get: (dbName: string) => memoizedGetPouchDb(dbName)
        .pipe(Effect.provide(context)),
    }))),
  accessors: true,
}) {
}
