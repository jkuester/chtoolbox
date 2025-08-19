import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { type AllDocsResponseStream, getDoc, PouchDBService, streamAllDocPages, streamQueryPages } from './pouchdb.ts';
import { Array, Option, pipe, Predicate, Schema, Stream, String, Record } from 'effect';
import { purgeFrom } from '../libs/couch/purge.ts';
import { ChtClientService } from './cht-client.ts';
import { ReadonlyArray } from 'effect/Array';
type AllDocsResponse = PouchDB.Core.AllDocsResponse<object>;
type AllDocsWithKeysResponse = PouchDB.Core.AllDocsWithKeysResponse<object>;

// _purge endpoint only accepts batches of 100.
// skip: 0 just keeps getting the next 100 (after the last was purged)
const PAGE_OPTIONS = { limit: 100, skip: 0 };

const AllDocsRow = Schema.Struct({ id: Schema.String, value: Schema.Struct({ rev: Schema.String }) });
const convertAllDocsResponse = (response: AllDocsResponse | AllDocsWithKeysResponse) => pipe(
  response.rows as unknown[],
  Array.filter(Schema.is(AllDocsRow)),
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
) => pipe(
  opts,
  streamQueryPages(dbName, viewName),
  Effect.map(Stream.tap(purgeDocsFromResponse(dbName))),
);

class UserDoc extends Schema.Class<UserDoc>('UserDoc')({
  _id: Schema.String,
  password_change_required: Schema.UndefinedOr(Schema.Boolean),
  roles: Schema.Array(Schema.String),
}) {
}

class ChtSettings extends Schema.Class<ChtSettings>('ChtSettings')({
  permissions: Schema.Struct({
    can_skip_password_change: Schema.UndefinedOr(Schema.Array(Schema.String)),
  })
}) {
}

const hasPasswordChangeRequired = ({ password_change_required }: UserDoc) => Predicate
  .isTruthy(password_change_required);

const canSkipPasswordChangeRolesEffect = Effect.cached(pipe(
  'settings',
  getDoc('medic'),
  Effect.tap(Effect.logDebug('Retrieved settings doc')),
  Effect.map(Option.flatMap(Schema.decodeUnknownOption(ChtSettings))),
  Effect.map(Option.map(({  permissions }) => permissions.can_skip_password_change)),
  Effect.map(Option.flatMap(Option.fromNullable)),
  Effect.map(Option.getOrElse(() => [] as string[])),
));

const hasCanSkipPasswordChangePermission = ({ roles }: UserDoc) => pipe(
  canSkipPasswordChangeRolesEffect,
  Effect.flatten,
  Effect.map(Array.union(roles)),
  Effect.map(Array.isNonEmptyArray),
);

const getAllUsers = pipe(
  { include_docs: true },
  streamAllDocPages('_users'),
  Effect.map(Stream.map(({ rows }) => rows)),
  Effect.map(Stream.map(Array.map(({ doc }) => Schema.decodeUnknownOption(UserDoc)(doc)))),
  Effect.map(Stream.map(Array.map(Option.filter(hasPasswordChangeRequired)))),
  Effect.map(Stream.map(Array.map(Option.getOrUndefined))),
  Effect.map(Stream.map(Array.filter(Predicate.isNotNullable))),
  Effect.map(Stream.map(Effect.filter(hasCanSkipPasswordChangePermission))),
  // Effect.map(Stream.map(Array.map(Option.filter(hasCanSkipPasswordChangePermission)))),
  x => x,
);

/*
 * Get users with password_change_required = true.
 *  - For each, check if they have can_skip_password_change permission
 *  - If so, set password_change_required = false
 */

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
    purgeAll: (dbName: string, purgeDdocs = false): Effect.Effect<AllDocsResponseStream, Error> => pipe(
      PAGE_OPTIONS,
      streamAllDocPages(dbName),
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
