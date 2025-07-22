import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Chunk, Match, Option, pipe, Predicate, Redacted, Stream, String } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core.js';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
import PouchDBMapReduce from 'pouchdb-mapreduce';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import { EnvironmentService } from './environment.js';
import https from 'https';
const HTTPS_AGENT_ALLOW_INVALID_SSL = new https.Agent({
    rejectUnauthorized: false,
});
PouchDB.plugin(PouchDBAdapterHttp);
PouchDB.plugin(PouchDBSessionAuthentication);
PouchDB.plugin(PouchDBMapReduce);
const isPouchResponse = (value) => 'ok' in value && value.ok;
// TODO Consider refactoring to use getPouchResponse instead of this function.
// Pouch errors are def the kind of thing that could realistically happen (e.g. network issues)
export const assertPouchResponse = (value) => pipe(Option.liftPredicate(value, isPouchResponse), Option.getOrThrowWith(() => value));
const getPouchResponse = (value) => pipe(Option.liftPredicate(value, isPouchResponse), Option.map(Effect.succeed), Option.getOrElse(() => Effect.fail(value)));
const allDocs = (db, options) => Effect
    .promise(() => db.allDocs(options));
const getAllDocsPage = (db, options) => (skip) => allDocs(db, { skip, ...options })
    .pipe(Effect.map((response) => [
    response,
    Option.liftPredicate(skip + options.limit, () => response.rows.length === options.limit),
]));
// TODO Consider accepting dbName here instead of db.
export const streamAllDocPages = (options = {}) => (db) => pipe(getAllDocsPage(db, { ...options, limit: options.limit ?? 1000 }), pageFn => Stream.paginateEffect(0, pageFn));
export const getAllDocs = (dbName) => (options = {}) => PouchDBService
    .get(dbName)
    .pipe(Effect.flatMap(db => allDocs(db, { ...options, include_docs: true })), Effect.map(({ rows }) => rows), Effect.map(Array.map(({ doc }) => doc)), Effect.map(Array.filter(Predicate.isNotNullable)));
const bulkDocs = (dbName) => (docs) => PouchDBService
    .get(dbName)
    .pipe(Effect.flatMap(db => Effect.promise(() => db.bulkDocs(docs))), Effect.map(Array.map(getPouchResponse)), Effect.flatMap(Effect.all));
export const deleteDocs = (dbName) => (docs) => pipe(docs, Array.map(doc => ({ ...doc, _deleted: true })), bulkDocs(dbName));
export const saveDoc = (dbName) => (doc) => PouchDBService
    .get(dbName)
    .pipe(Effect.flatMap(db => Effect.promise(() => db.put(doc))), Effect.flatMap(getPouchResponse));
const query = (db, viewIndex, options) => Effect
    .promise(() => db.query(viewIndex, options));
const getQueryPage = (db, viewIndex, options) => (skip) => query(db, viewIndex, { skip, ...options })
    .pipe(Effect.map((response) => [
    response,
    Option.liftPredicate(skip + options.limit, () => response.rows.length === options.limit),
]));
export const streamQueryPages = (viewIndex, options = {}) => (db) => pipe(getQueryPage(db, viewIndex, { ...options, limit: options.limit ?? 1000 }), pageFn => Stream.paginateEffect(0, pageFn));
const failStreamForError = (emit) => (err) => Effect
    .logDebug('Error streaming changes feed:', err)
    .pipe(Effect.andThen(Effect.fail(Option.some(err))), emit);
const endStream = (emit) => () => Effect
    .logDebug('Changes feed stream completed')
    .pipe(Effect.andThen(Effect.fail(Option.none())), emit);
const cancelChangesFeedIfInterrupted = (feed) => Effect
    .succeed(() => feed.cancel())
    .pipe(Effect.map(fn => fn()), Effect.andThen(Effect.logDebug('Changes feed canceled because the stream was interrupted')));
export const streamChanges = (options) => (db) => pipe({ since: options?.since ?? 0 }, // Caching the since value in case the Stream is retried
// Caching the since value in case the Stream is retried
cache => Stream.async((emit) => pipe(db.changes({ ...options, since: cache.since, live: true }), feed => feed
    .on('error', failStreamForError(emit))
    .on('complete', endStream(emit))
    .on('change', (change) => Effect
    .logDebug('Emitting change:', change)
    .pipe(Effect.andThen(Effect.succeed(Chunk.of(change))), emit, () => cache.since = change.seq)), cancelChangesFeedIfInterrupted)));
const couchUrl = EnvironmentService
    .get()
    .pipe(Effect.map(({ url }) => url));
const getAgent = (url) => Match
    .value(url)
    .pipe(Match.when(String.startsWith('https://'), () => HTTPS_AGENT_ALLOW_INVALID_SSL), Match.orElse(() => undefined));
const getPouchDB = (dbName) => couchUrl.pipe(Effect.map(url => pouchDB(`${Redacted.value(url)}${dbName}`, 
// @ts-expect-error Setting the `agent` option is not in the PouchDB types for some reason
{ fetch: (url, opts) => PouchDB.fetch(url, { ...opts, agent: getAgent(url) }) })));
const serviceContext = EnvironmentService.pipe(Effect.map(env => Context.make(EnvironmentService, env)));
export class PouchDBService extends Effect.Service()('chtoolbox/PouchDBService', {
    effect: Effect
        .all([
        serviceContext,
        Effect.cachedFunction(getPouchDB),
    ])
        .pipe(Effect.map(([context, memoizedGetPouchDb]) => ({
        get: (dbName) => memoizedGetPouchDb(dbName)
            .pipe(Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=pouchdb.js.map