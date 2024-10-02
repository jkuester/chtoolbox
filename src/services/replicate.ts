import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Config, Option, pipe, Redacted, Ref, String } from 'effect';
import { assertPouchResponse, PouchDBService } from './pouchdb';
import { EnvironmentService } from './environment';
import { Schema } from '@effect/schema';

export interface ReplicateService {
  readonly replicate: (source: string, target: string) => Effect.Effect<PouchDB.Core.Response, Error>,
  readonly watch: (repDocId: string) => Effect.Effect<PouchDB.Core.Changes<ReplicationDoc>, Error>
}

export const ReplicateService = Context.GenericTag<ReplicateService>('chtoolbox/ReplicateService');

const getPouchDb = (dbName: string) => Effect.flatMap(PouchDBService, pouch => pouch.get(dbName));

const couchUrl = EnvironmentService.pipe(
  Effect.map(service => service.get()),
  Effect.map(env => env.url),
  Effect.flatMap(Ref.get),
  Effect.flatMap(Config.map(Redacted.value)),
  Effect.map(url => pipe(
    Option.liftPredicate(url, String.endsWith('/')),
    Option.getOrElse(() => `${url}/`),
  )),
);

const COUCH_USER_PATTERN = /^https?:\/\/([^:]+):.+$/;
const getCouchUser = (url: string) => pipe(// TODO centralize this logic
  COUCH_USER_PATTERN.exec(url)?.[1],
  Option.fromNullable,
  Option.getOrThrow,
);

const createReplicationDoc = (source: string, target: string) => couchUrl.pipe(
  Effect.map(url => pipe(
    getCouchUser(url),
    owner => ({
      user_ctx: {
        name: owner,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${url}${source}` },
      target: { url: `${url}${target}` },
      create_target: false,
      continuous: false,
      owner,
    }),
  )),
);

const ServiceContext = Effect
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

export class ReplicationDoc extends Schema.Class<ReplicationDoc>('ReplicationDoc')({
  _replication_state: Schema.String,
  _replication_stats: Schema.Struct({
    docs_written: Schema.Number,
  }),
}) {
}

export const ReplicateServiceLive = Layer.effect(ReplicateService, ServiceContext.pipe(Effect.map(
  context => ReplicateService.of({
    replicate: (source: string, target: string) => Effect
      .all([getPouchDb('_replicator'), createReplicationDoc(source, target)])
      .pipe(
        Effect.flatMap(([db, doc]) => Effect.promise(() => db.bulkDocs([doc]))),
        Effect.map(([resp]) => resp),
        Effect.map(assertPouchResponse),
        Effect.mapError(x => x as Error),
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
  }),
)));
