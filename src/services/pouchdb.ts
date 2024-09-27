import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Config, Layer, Option, pipe, Redacted, Ref, String } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import PouchDBReplication from 'pouchdb-replication';
import { EnvironmentService } from './environment';

PouchDB.plugin(PouchDBAdapterHttp);
PouchDB.plugin(PouchDBSessionAuthentication);
PouchDB.plugin(PouchDBReplication);

export interface PouchDBService {
  readonly get: (dbName: string) => Effect.Effect<PouchDB.Database, Error>
}

export const PouchDBService = Context.GenericTag<PouchDBService>('chtoolbox/PouchDBService');

const couchUrl = EnvironmentService.pipe(
  Effect.map(service => service.get()),
  Effect.map(env => env.url),
  Effect.flatMap(Ref.get),
  Effect.map(Config.map(Redacted.value)),
  Effect.map(Config.map(url => pipe(
    Option.liftPredicate(url, String.endsWith('/')),
    Option.getOrElse(() => `${url}/`),
  ))),
  Effect.flatten,
  Effect.mapError(x => x as unknown as Error),
);

const getPouchDB = (dbName: string) => couchUrl.pipe(Effect.map(url => pouchDB(`${url}${dbName}`)));

const ServiceContext = EnvironmentService.pipe(Effect.map(env => Context.make(EnvironmentService, env)));

export const PouchDBServiceLive = Layer.effect(PouchDBService, Effect
  .all([
    ServiceContext,
    Effect.cachedFunction(getPouchDB),
  ])
  .pipe(Effect.map(
    ([context, memoizedGetPouchDb]) => PouchDBService.of({
      get: (dbName: string) => memoizedGetPouchDb(dbName)
        .pipe(Effect.provide(context)),
    }),
  )));
