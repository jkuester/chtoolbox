import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Layer, Option, pipe, Redacted } from 'effect';
import PouchDB from 'pouchdb-core';
import { pouchDB } from '../libs/core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
// @ts-expect-error no types for this package
import PouchDBSessionAuthentication from 'pouchdb-session-authentication';
import { EnvironmentService } from './environment';

PouchDB.plugin(PouchDBAdapterHttp);
PouchDB.plugin(PouchDBSessionAuthentication);

export interface PouchDBService {
  readonly get: (dbName: string) => Effect.Effect<PouchDB.Database, Error>
}

export const PouchDBService = Context.GenericTag<PouchDBService>('chtoolbox/PouchDBService');

const isPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): value is PouchDB.Core.Response => 'ok' in value && value.ok;

export const assertPouchResponse = (
  value: PouchDB.Core.Response | PouchDB.Core.Error
): PouchDB.Core.Response => pipe(
  Option.liftPredicate(value, isPouchResponse),
  Option.getOrThrowWith(() => value),
);

const couchUrl = EnvironmentService.pipe(
  Effect.flatMap(service => service.get()),
  Effect.map(({ url }) => url),
);

const getPouchDB = (dbName: string) => couchUrl.pipe(Effect.map(url => pouchDB(`${Redacted.value(url)}${dbName}`)));

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
