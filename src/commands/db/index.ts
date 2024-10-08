import { Command } from '@effect/cli';
import { inspect } from './inspect';
import { replicate } from './replicate';

export const db = Command
  .make('db', {})
  .pipe(
    Command.withDescription(`Manage Couch databases.`),
    Command.withSubcommands([inspect, replicate])
  );
