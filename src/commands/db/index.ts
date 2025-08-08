import { Command } from '@effect/cli';
import { inspect } from './inspect.ts';
import { create } from './create.ts';
import { rm } from './rm.ts';
import { compact } from './compact.ts';
import { ls } from './ls.ts';

export const db = Command
  .make('db', {})
  .pipe(
    Command.withDescription(`Manage Couch databases.`),
    Command.withSubcommands([create, compact, inspect, ls, rm])
  );
