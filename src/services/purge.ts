import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { AllDocsResponseStream, PouchDBService, streamAllDocPages, streamQueryPages } from './pouchdb.js';
import { Array, Option, pipe, Predicate, Schema, Stream, String } from 'effect';
import { purgeFrom } from '../libs/couch/purge.js';
import { ChtClientService } from './cht-client.js';
import AllDocsResponse = PouchDB.Core.AllDocsResponse;
import AllDocsWithKeysResponse = PouchDB.Core.AllDocsWithKeysResponse;

// _purge endpoint only accepts batches of 100.
// skip: 0 just keeps getting the next 100 (after the last was purged)
const PAGE_OPTIONS = { limit: 100, skip: 0 };

const AllDocsRow = Schema.Struct({ id: Schema.String, value: Schema.Struct({ rev: Schema.String }) });
const convertAllDocsResponse = (response: AllDocsResponse<object> | AllDocsWithKeysResponse<object>) => pipe(
  response.rows as unknown[],
  Array.filter(Schema.is(AllDocsRow)),
  x => x,
  Array.map(({ id, value: { rev } }) => ({ _id: id, _rev: rev }))
);

const filterDdoc = (purgeDdocs: boolean) => (doc: { _id: string }) => Option
  .liftPredicate(doc, () => !purgeDdocs)
  .pipe(
    Option.map(({ _id }) => _id),
    Option.map(Predicate.not(String.startsWith('_design/'))),
    Option.getOrElse(() => true),
  );

const purgeRows = (dbName: string) => (rows: { _id: string, _rev: string }[]) => Option
  .liftPredicate(rows, Array.isNonEmptyArray)
  .pipe(
    Option.map(purgeFrom(dbName)),
    Option.map(Effect.andThen(Effect.void)),
    Option.getOrElse(() => Effect.void),
  );

const getReportQueryOptions = (
  { since, before }: { since: Option.Option<Date>, before: Option.Option<Date> },
) => ({
  ...PAGE_OPTIONS,
  startkey: since.pipe(
    Option.map(date => [date.getTime()]),
    Option.getOrUndefined,
  ),
  endkey: before.pipe(
    Option.map(date => [date.getTime()]),
    Option.getOrUndefined,
  ),
});

const getAllDocs = (dbName: string) => (keys: string[]) => PouchDBService
  .get(dbName)
  .pipe(Effect.flatMap(db => Effect.promise(() => db.allDocs({ keys }))));

const purgeDocsFromResponse = (dbName: string) => (response: PouchDB.Query.Response<object>) => pipe(
  response.rows,
  Array.map(({ id }) => id as string),
  getAllDocs(dbName),
  Effect.map(convertAllDocsResponse),
  Effect.flatMap(purgeRows(dbName)),
);

const purgeByViewQuery = (dbName: string, viewName: string) => (
  opts: PouchDB.Query.Options<object, object>
) => PouchDBService
  .get(dbName)
  .pipe(
    Effect.map(streamQueryPages(viewName, opts)),
    Effect.map(Stream.tap(purgeDocsFromResponse(dbName))),
  );

const serviceContext = Effect
  .all([
    ChtClientService,
    PouchDBService,
  ])
  .pipe(Effect.map(([
    chtClient,
    pouch,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(ChtClientService, chtClient))));

export class PurgeService extends Effect.Service<PurgeService>()('chtoolbox/PurgeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    purgeAll: (dbName: string, purgeDdocs = false): Effect.Effect<AllDocsResponseStream, Error> => PouchDBService
      .get(dbName)
      .pipe(
        Effect.map(streamAllDocPages(PAGE_OPTIONS)),
        Effect.map(Stream.tap(response => pipe(
          convertAllDocsResponse(response),
          Array.filter(filterDdoc(purgeDdocs)),
          purgeRows(dbName),
        ))),
        Effect.map(Stream.provideContext(context)),
        Effect.provide(context),
      ),
    purgeReports: (
      dbName: string,
      opts: { since: Option.Option<Date>, before: Option.Option<Date> }
    ): Effect.Effect<AllDocsResponseStream, Error> => pipe(
      getReportQueryOptions(opts),
      purgeByViewQuery(dbName, 'medic-client/reports_by_date'),
      Effect.map(Stream.provideContext(context)),
      Effect.provide(context),
    ),
    purgeContacts: (
      dbName: string,
      type: string,
    ): Effect.Effect<AllDocsResponseStream, Error> => pipe(
      { ...PAGE_OPTIONS, key: [type] },
      purgeByViewQuery(dbName, 'medic-client/contacts_by_type'),
      Effect.map(Stream.provideContext(context)),
      Effect.provide(context),
    )
  }))),
  accessors: true,
}) {
}
