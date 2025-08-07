import { Args, Command } from '@effect/cli';
import { Effect } from 'effect';
import { initializeUrl } from "../../index.js";
import { getDbsInfoByName } from "../../libs/couch/dbs-info.js";
import { logJson } from "../../libs/console.js";
const databases = Args
    .text({ name: 'database' })
    .pipe(Args.withDescription('The database to inspect'), Args.atLeast(1));
export const inspect = Command
    .make('inspect', { databases }, ({ databases }) => initializeUrl.pipe(Effect.andThen(getDbsInfoByName(databases)), Effect.tap(logJson)))
    .pipe(Command.withDescription(`Display detailed information on one or more Couch databases`));
