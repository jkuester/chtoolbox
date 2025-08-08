import { Command } from '@effect/cli';
import { inspect } from "./inspect.js";
import { create } from "./create.js";
import { rm } from "./rm.js";
import { compact } from "./compact.js";
import { ls } from "./ls.js";
export const db = Command
    .make('db', {})
    .pipe(Command.withDescription(`Manage Couch databases.`), Command.withSubcommands([create, compact, inspect, ls, rm]));
