import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { assertPouchResponse, PouchDBService } from './pouchdb';
import { EnvironmentService } from './environment';
import { Schema } from '@effect/schema';
import { Redacted } from 'effect';

const getPouchDb = (dbName: string) => Effect.flatMap(PouchDBService, pouch => pouch.get(dbName));

const environment = Effect.flatMap(EnvironmentService, envSvc => envSvc.get());

const createReplicationDoc = (source: string, target: string) => environment.pipe(
  Effect.map(env => ({
    user_ctx: {
      name: env.user,
      roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: `${Redacted.value(env.url)}${source}` },
    target: { url: `${Redacted.value(env.url)}${target}` },
    create_target: false,
    continuous: false,
    owner: env.user,
  })),
);

export class ReplicationDoc extends Schema.Class<ReplicationDoc>('ReplicationDoc')({
  _replication_state: Schema.String,
  _replication_stats: Schema.Struct({
    docs_written: Schema.Number,
  }),
}) {
}

const serviceContext = Effect
  .all([
    EnvironmentService,
    PouchDBService,
  ])
  .pipe(Effect.map(([
    env,
    pouch,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(EnvironmentService, env))));

export class ReplicateService extends Effect.Service<ReplicateService>()('chtoolbox/ReplicateService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    replicate: (source: string, target: string) => Effect
      .all([getPouchDb('_replicator'), createReplicationDoc(source, target)])
      .pipe(
        Effect.flatMap(([db, doc]) => Effect.promise(() => db.bulkDocs([doc]))),
        Effect.map(([resp]) => resp),
        Effect.map(assertPouchResponse),
        Effect.provide(context),
      ),
    watch: (repDocId: string) => getPouchDb('_replicator')
      .pipe(
        Effect.map(db => (db as PouchDB.Database<ReplicationDoc>).changes({
          since: 'now',
          live: true,
          include_docs: true,
          doc_ids: [repDocId],
        })),
        Effect.provide(context),
      ),
  }))),
  accessors: true,
}) {
}
