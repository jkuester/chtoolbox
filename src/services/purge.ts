import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, streamAllDocPages } from './pouchdb';
import { Array, pipe, Stream } from 'effect';
import { CouchPurgeService, purgeFrom } from './couch/purge';
import AllDocsResponse = PouchDB.Core.AllDocsResponse;

const convertAllDocsResponse = (response: AllDocsResponse<object>) => pipe(
  response.rows,
  Array.map(({ id, value: { rev } }) => ({ _id: id, _rev: rev }))
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
    purgeAll: (dbName: string) => PouchDBService
      .get(dbName)
      .pipe(
        // _purge endpoint only accepts batches of 100.
        // skip: 0 just keeps getting the next 100 (after the last was purged)
        Effect.map(streamAllDocPages({ limit: 100, skip: 0 })),
        // Effect.map(Stream.tap(x => Console.log(x.offset, x.total_rows))),
        Effect.map(Stream.tap(response => pipe(
          convertAllDocsResponse(response),
          purgeFrom(dbName),
        ))),

        // Effect.map(Stream.map(convertAllDocsResponse)),
        //
        //
        // Effect.map(Stream.mapEffect(purgeFrom(dbName))),
        // Effect.flatMap(Stream.run(Sink.drain)),
        Effect.provide(context),
        x => x,
      ),
  }))),
  accessors: true,
}) {
}
