import { Args, Command } from '@effect/cli';
import { Console, Effect, pipe, Array } from 'effect';
import { initializeUrl } from '../../index';
import { PouchDBService } from '../../services/pouchdb';

const getPouchDB = (dbName: string) => Effect.flatMap(PouchDBService, svc => svc.get(dbName));

const createDbs = (dbs: string[]) => pipe(
  dbs,
  Array.map(getPouchDB),
  Effect.all,
);

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The name of the database to create'),
    Args.atLeast(1),
  );

export const create = Command
  .make('create', { databases }, ({ databases }) => initializeUrl.pipe(
    Effect.andThen(createDbs(databases)),
    Effect.map(Array.map(db => Effect.promise(() => db.info()))),
    Effect.flatMap(Effect.all),
    Effect.tap(Console.log),
  ))
  .pipe(Command.withDescription(`Create new Couch database. Nothing happens if the database already exists.`));
