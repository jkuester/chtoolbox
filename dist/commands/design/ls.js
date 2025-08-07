import { Args, Command } from '@effect/cli';
import { Array, Effect, Option, pipe, Record } from 'effect';
import { initializeUrl } from "../../index.js";
import { getDesignDocNames } from "../../libs/couch/design-docs.js";
import { getDbNames } from "../../libs/couch/dbs-info.js";
import { logJson } from '../../libs/console.js';
const printDesignDocNames = (dbName) => getDesignDocNames(dbName)
    .pipe(Effect.flatMap(logJson));
const getDisplayDict = (data) => Array.reduce(data, {}, (dict, [designNames, dbName]) => Record.set(dbName, designNames)(dict));
const printAllDesignDocNames = getDbNames()
    .pipe(Effect.flatMap(dbNames => pipe(Array.map(dbNames, getDesignDocNames), Effect.allWith({ concurrency: 'unbounded' }), Effect.map(Array.zip(dbNames)), Effect.map(getDisplayDict))), Effect.flatMap(logJson));
const database = Args
    .text({ name: 'database' })
    .pipe(Args.withDescription('The database with the designs to list'), Args.optional);
export const ls = Command
    .make('ls', { database }, ({ database }) => initializeUrl.pipe(Effect.andThen(Effect.succeed(database)), Effect.map(Option.map(printDesignDocNames)), Effect.flatMap(Option.getOrElse(() => printAllDesignDocNames))))
    .pipe(Command.withDescription(`List designs for a Couch database`));
//# sourceMappingURL=ls.js.map