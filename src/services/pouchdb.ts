import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Chunk, Match, Option, pipe, Redacted, Stream, StreamEmit, String } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core.ts';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
import PouchDBMapReduce from 'pouchdb-mapreduce';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import { EnvironmentService } from './environment.ts';
import https from 'https';
import { v4 as uuid } from 'uuid';
import { UnknownException } from 'effect/Cause';

const HTTPS_AGENT_ALLOW_INVALID_SSL = new https.Agent({
  rejectUnauthorized: false,
});
PouchDB.plugin(PouchDBAdapterHttp);
PouchDB.plugin(PouchDBSessionAuthentication);
PouchDB.plugin(PouchDBMapReduce);

const isPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): value is PouchDB.Core.Response => 'ok' in value && value.ok;

const getPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): Effect.Effect<PouchDB.Core.Response, PouchDB.Core.Error> => pipe(
  Option.liftPredicate(value, isPouchResponse),
  Option.map(Effect.succeed),
  Option.getOrElse(() => Effect.fail(value as PouchDB.Core.Error)),
);

type AllDocsOptions = PouchDB.Core.AllDocsWithKeyOptions |
  PouchDB.Core.AllDocsWithinRangeOptions |
  PouchDB.Core.AllDocsOptions |
  PouchDB.Core.AllDocsWithKeysOptions;
type AllDocsOptionsWithLimit = Omit<AllDocsOptions, 'limit'> & { limit: number };
const allDocs = (db: PouchDB.Database, options: AllDocsOptions) => Effect
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
export const streamAllDocPages = (dbName: string) => (
  options: AllDocsOptions = {}
): Effect.Effect<AllDocsResponseStream, never, PouchDBService> => PouchDBService
  .get(dbName)
  .pipe(
    Effect.map(db => getAllDocsPage(db, { ...options, limit: options.limit ?? 1000 })),
    Effect.map(pageFn => Stream.paginateEffect(0, pageFn)),
  );

type Doc = PouchDB.Core.AllDocsMeta & PouchDB.Core.IdMeta & PouchDB.Core.RevisionIdMeta;

// export const getAllDocs = (dbName: string) => (
//   options: AllDocsOptions = {}
// ): Effect.Effect<Doc[], never, PouchDBService> => PouchDBService
//   .get(dbName)
//   .pipe(
//     Effect.flatMap(db => allDocs(db, { ...options, include_docs: true })),
//     Effect.map(({ rows }) => rows),
//     Effect.map(Array.map(({ doc }) => doc)),
//     Effect.map(Array.filter(Predicate.isNotNullable)),
//   );

// const bulkDocs = (dbName: string) => (
//   docs: PouchDB.Core.PutDocument<object>[]
// ) => PouchDBService
//     .get(dbName)
//     .pipe(
//       Effect.flatMap(db => Effect.promise(() => db.bulkDocs(docs))),
//       Effect.map(Array.map(getPouchResponse)),
//       Effect.flatMap(Effect.all),
//     );
//
// export const deleteDocs = (dbName: string) => (
//   docs: NonEmptyArray<Doc>
// ): Effect.Effect<PouchDB.Core.Response[], PouchDB.Core.Error, PouchDBService> => pipe(
//   docs,
//   Array.map(doc => ({ ...doc, _deleted: true })),
//   bulkDocs(dbName),
// );

export const saveDoc = (dbName: string) => (
  doc:  object
): Effect.Effect<PouchDB.Core.Response, PouchDB.Core.Error, PouchDBService> => PouchDBService
  .get(dbName)
  .pipe(
    Effect.flatMap(db => Effect.promise(() => db.put({
      ...doc,
      _id: (doc as { _id?: string })._id ?? uuid(),
    }))),
    Effect.flatMap(getPouchResponse),
  );

export const getDoc = (dbName: string) => (
  id: string
): Effect.Effect<Option.Option<Doc>, UnknownException, PouchDBService> => PouchDBService
  .get(dbName)
  .pipe(
    Effect.flatMap(db => Effect.tryPromise(() => db.get(id))),
    Effect.catchIf(
      ({ error }) => (error as PouchDB.Core.Error).status === 404,
      () => Effect.succeed(null)
    ),
    Effect.map(Option.fromNullable),
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

export const streamQueryPages = (dbName: string, viewIndex: string) => (
  options: PouchDB.Query.Options<object, object> = {}
): Effect.Effect<Stream.Stream<PouchDB.Query.Response<object>>, never, PouchDBService> => PouchDBService
  .get(dbName)
  .pipe(
    Effect.map(db => getQueryPage(db, viewIndex, { ...options, limit: options.limit ?? 1000 })),
    Effect.map(pageFn => Stream.paginateEffect(0, pageFn)),
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

export const streamChanges = (dbName: string) => (
  options?: PouchDB.Core.ChangesOptions
): Effect.Effect<
  Stream.Stream<PouchDB.Core.ChangesResponseChange<object>, Error>,
  never,
  PouchDBService
> => PouchDBService
  .get(dbName)
  .pipe(Effect.map(db => pipe(
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
  )));

const couchUrl = EnvironmentService
  .get()
  .pipe(Effect.map(({ url }) => url));

const getAgent = (url: string) => Match
  .value(url)
  .pipe(
    Match.when(String.startsWith('https://'), () => HTTPS_AGENT_ALLOW_INVALID_SSL),
    Match.orElse(() => undefined),
  );

const getPouchDB = (dbName: string) => couchUrl.pipe(Effect.map(url => pouchDB(
  `${Redacted.value(url)}${dbName}`,
  // @ts-expect-error Setting the `agent` option is not in the PouchDB types for some reason
  { fetch: (url, opts) => PouchDB.fetch(url, { ...opts, agent: getAgent(url) }) }
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
