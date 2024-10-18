import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, streamAllDocPages } from './pouchdb';
import { Array, Option, pipe, Predicate, Stream, String } from 'effect';
import { CouchPurgeService, purgeFrom } from './couch/purge';
import AllDocsResponse = PouchDB.Core.AllDocsResponse;

const convertAllDocsResponse = (response: AllDocsResponse<object>) => pipe(
  response.rows,
  Array.map(({ id, value: { rev } }) => ({ _id: id, _rev: rev }))
);

const filterDdoc = (purgeDdocs: boolean) => (doc: { _id: string }) => Option
  .liftPredicate(doc, () => !purgeDdocs)
  .pipe(
    Option.map(({ _id }) => _id),
    Option.map(Predicate.not(String.startsWith('_design/'))),
    Option.getOrElse(() => true),
  );

const serviceContext = Effect
  .all([
    CouchPurgeService,
    PouchDBService,
  ])
  .pipe(Effect.map(([
    purge,
    pouch,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(CouchPurgeService, purge))));

export class PurgeService extends Effect.Service<PurgeService>()('chtoolbox/PurgeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    purgeAll: (dbName: string, purgeDdocs = false) => PouchDBService
      .get(dbName)
      .pipe(
        // _purge endpoint only accepts batches of 100.
        // skip: 0 just keeps getting the next 100 (after the last was purged)
        Effect.map(streamAllDocPages({ limit: 100, skip: 0 })),
        Effect.map(Stream.tap(response => pipe(
          convertAllDocsResponse(response),
          Array.filter(filterDdoc(purgeDdocs)),
          Option.liftPredicate(Array.isNonEmptyArray),
          Option.map(purgeFrom(dbName)),
          Option.getOrElse(() => Effect.void),
        ))),
        Effect.provide(context),
      ),
  }))),
  accessors: true,
}) {
}
