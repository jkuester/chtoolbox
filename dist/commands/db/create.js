import { Args, Command } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { initializeUrl } from "../../index.js";
import { PouchDBService } from "../../services/pouchdb.js";
import { logJson } from "../../libs/console.js";
const createDbs = Effect.fn((dbs) => pipe(dbs, Array.map(PouchDBService.get), Effect.allWith({ concurrency: 'unbounded' })));
const databases = Args
    .text({ name: 'database' })
    .pipe(Args.withDescription('The name of the database to create'), Args.atLeast(1));
export const create = Command
    .make('create', { databases }, Effect.fn(({ databases }) => initializeUrl.pipe(Effect.andThen(createDbs(databases)), Effect.map(Array.map(db => Effect.promise(() => db.info()))), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })), Effect.tap(logJson))))
    .pipe(Command.withDescription(`Create new Couch database. Nothing happens if the database already exists.`));
