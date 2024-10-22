import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Option, pipe, Redacted, Stream } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
import PouchDBMapReduce from 'pouchdb-mapreduce';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import { EnvironmentService } from './environment';

PouchDB.plugin(PouchDBAdapterHttp);
PouchDB.plugin(PouchDBSessionAuthentication);
PouchDB.plugin(PouchDBMapReduce);

const isPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): value is PouchDB.Core.Response => 'ok' in value && value.ok;

export const assertPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): PouchDB.Core.Response => pipe(
  Option.liftPredicate(value, isPouchResponse),
  Option.getOrThrowWith(() => value),
);

type AllDocsOptions = PouchDB.Core.AllDocsWithKeyOptions |
  PouchDB.Core.AllDocsWithinRangeOptions |
  PouchDB.Core.AllDocsOptions;
type AllDocsOptionsWithLimit = Omit<AllDocsOptions, 'limit'> & { limit: number };
const allDocs = (db: PouchDB.Database, options: AllDocsOptionsWithLimit) => Effect
  .promise(() => db.allDocs(options));
const getAllDocsPage = (
  db: PouchDB.Database,
  options: AllDocsOptionsWithLimit,
) => (
  skip: number
): Effect.Effect<[PouchDB.Core.AllDocsResponse<object>, Option.Option<number>]> => allDocs(db, { skip, ...options })
  .pipe(Effect.map((response) => [
    response,
    Option.liftPredicate(skip + options.limit, () => response.rows.length === options.limit),
  ]));
export const streamAllDocPages = (options: AllDocsOptions = {}) => (db: PouchDB.Database) => pipe(
  getAllDocsPage(db, { ...options, limit: options.limit ?? 1000 }),
  pageFn => Stream.paginateEffect(0, pageFn),
);

type QueryOptionsWithLimit = Omit<PouchDB.Query.Options<object, object>, 'limit'> & { limit: number };
const query = (db: PouchDB.Database, viewIndex: string, options: QueryOptionsWithLimit) => Effect
  .promise(() => db.query(viewIndex, options));
const getQueryPage = (
  db: PouchDB.Database,
  viewIndex: string,
  options: QueryOptionsWithLimit
) => (
  skip: number
): Effect.Effect<[PouchDB.Query.Response<object>, Option.Option<number>]> => query(db, viewIndex, { skip, ...options })
  .pipe(Effect.map((response) => [
    response,
    Option.liftPredicate(skip + options.limit, () => response.rows.length === options.limit),
  ]));
export const streamQueryPages = (
  viewIndex: string,
  options: PouchDB.Query.Options<object, object> = {}
) => (db: PouchDB.Database) => pipe(
  getQueryPage(db, viewIndex, { ...options, limit: options.limit ?? 1000 }),
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
