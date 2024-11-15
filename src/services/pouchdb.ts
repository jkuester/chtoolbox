import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Chunk, Option, pipe, Redacted, Stream, StreamEmit } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
import PouchDBMapReduce from 'pouchdb-mapreduce';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import { EnvironmentService } from './environment';
import https from 'https';

const AGENT_ALLOW_INVALID_SSL = new https.Agent({
  rejectUnauthorized: false,
});
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
export type AllDocsResponseStream = Stream.Stream<PouchDB.Core.AllDocsResponse<object>, Error>;
export const streamAllDocPages = (options: AllDocsOptions = {}) => (
  db: PouchDB.Database
): AllDocsResponseStream => pipe(
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
) => (db: PouchDB.Database): Stream.Stream<PouchDB.Query.Response<object>> => pipe(
  getQueryPage(db, viewIndex, { ...options, limit: options.limit ?? 1000 }),
  pageFn => Stream.paginateEffect(0, pageFn),
);

type ChangeEmit = StreamEmit.Emit<never, Error, PouchDB.Core.ChangesResponseChange<object>, void>;
const failStreamForError = (emit: ChangeEmit) => (err: unknown) => Effect
  .logDebug('Error streaming changes feed:', err)
  .pipe(
    Effect.andThen(Effect.fail(Option.some(err as Error))),
    emit,
  );
const endStream = (emit: ChangeEmit) => () => Effect
  .logDebug('Changes feed stream completed')
  .pipe(
    Effect.andThen(Effect.fail(Option.none())),
    emit,
  );
const cancelChangesFeedIfInterrupted = (feed: PouchDB.Core.Changes<object>) => Effect
  .succeed(() => feed.cancel())
  .pipe(
    Effect.map(fn => fn()),
    Effect.andThen(Effect.logDebug('Changes feed canceled because the stream was interrupted')),
  );
export const streamChanges = (options?: PouchDB.Core.ChangesOptions) => (
  db: PouchDB.Database
): Stream.Stream<PouchDB.Core.ChangesResponseChange<object>, Error> => pipe(
  { since: options?.since ?? 0 }, // Caching the since value in case the Stream is retried
  cache => Stream.async((emit: ChangeEmit) => pipe(
    db.changes({ ...options, since: cache.since, live: true }),
    feed => feed
      .on('error', failStreamForError(emit))
      .on('complete', endStream(emit))
      .on('change', (change) => Effect
        .logDebug('Emitting change:', change)
        .pipe(
          Effect.andThen(Effect.succeed(Chunk.of(change))),
          emit,
          () => cache.since = change.seq,
        )),
    cancelChangesFeedIfInterrupted,
  )),
);

const couchUrl = EnvironmentService
  .get()
  .pipe(Effect.map(({ url }) => url));

const getPouchDB = (dbName: string) => couchUrl.pipe(Effect.map(url => pouchDB(
  `${Redacted.value(url)}${dbName}`,
  // @ts-expect-error Setting the `agent` option is not in the PouchDB types for some reason
  { fetch: (url, opts) => PouchDB.fetch(url, { ...opts, agent: AGENT_ALLOW_INVALID_SSL }) }
)));

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
