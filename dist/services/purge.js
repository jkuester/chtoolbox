import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, streamAllDocPages, streamQueryPages } from './pouchdb.js';
import { Array, Option, pipe, Predicate, Schema, Stream, String } from 'effect';
import { purgeFrom } from '../libs/couch/purge.js';
import { ChtClientService } from './cht-client.js';
// _purge endpoint only accepts batches of 100.
// skip: 0 just keeps getting the next 100 (after the last was purged)
const PAGE_OPTIONS = { limit: 100, skip: 0 };
const AllDocsRow = Schema.Struct({ id: Schema.String, value: Schema.Struct({ rev: Schema.String }) });
const convertAllDocsResponse = (response) => pipe(response.rows, Array.filter(Schema.is(AllDocsRow)), Array.map(({ id, value: { rev } }) => ({ _id: id, _rev: rev })));
const filterDdoc = (purgeDdocs) => (doc) => Option
    .liftPredicate(doc, () => !purgeDdocs)
    .pipe(Option.map(({ _id }) => _id), Option.map(Predicate.not(String.startsWith('_design/'))), Option.getOrElse(() => true));
const purgeRows = (dbName) => (rows) => Option
    .liftPredicate(rows, Array.isNonEmptyArray)
    .pipe(Option.map(purgeFrom(dbName)), Option.map(Effect.andThen(Effect.void)), Option.getOrElse(() => Effect.void));
const getReportQueryOptions = ({ since, before }) => ({
    ...PAGE_OPTIONS,
    startkey: since.pipe(Option.map(date => [date.getTime()]), Option.getOrUndefined),
    endkey: before.pipe(Option.map(date => [date.getTime()]), Option.getOrUndefined),
});
const getAllDocs = (dbName) => (keys) => PouchDBService
    .get(dbName)
    .pipe(Effect.flatMap(db => Effect.promise(() => db.allDocs({ keys }))));
const purgeDocsFromResponse = (dbName) => (response) => pipe(response.rows, Array.map(({ id }) => id), getAllDocs(dbName), Effect.map(convertAllDocsResponse), Effect.flatMap(purgeRows(dbName)));
const purgeByViewQuery = (dbName, viewName) => (opts) => pipe(opts, streamQueryPages(dbName, viewName), Effect.map(Stream.tap(purgeDocsFromResponse(dbName))));
const serviceContext = Effect
    .all([
    ChtClientService,
    PouchDBService,
])
    .pipe(Effect.map(([chtClient, pouch,]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(ChtClientService, chtClient))));
export class PurgeService extends Effect.Service()('chtoolbox/PurgeService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        purgeAll: (dbName, purgeDdocs = false) => pipe(PAGE_OPTIONS, streamAllDocPages(dbName), Effect.map(Stream.tap(response => pipe(convertAllDocsResponse(response), Array.filter(filterDdoc(purgeDdocs)), purgeRows(dbName)))), Effect.map(Stream.provideContext(context)), Effect.provide(context)),
        purgeReports: (dbName, opts) => pipe(getReportQueryOptions(opts), purgeByViewQuery(dbName, 'medic-client/reports_by_date'), Effect.map(Stream.provideContext(context)), Effect.provide(context)),
        purgeContacts: (dbName, type) => pipe({ ...PAGE_OPTIONS, key: [type] }, purgeByViewQuery(dbName, 'medic-client/contacts_by_type'), Effect.map(Stream.provideContext(context)), Effect.provide(context))
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=purge.js.map