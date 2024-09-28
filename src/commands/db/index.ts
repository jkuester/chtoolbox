import { Command } from '@effect/cli';
import { inspect } from './inspect';

export const db = Command
  .make('db', {})
  .pipe(
    Command.withDescription(`Manage Couch databases.`),
    Command.withSubcommands([inspect])
  );
