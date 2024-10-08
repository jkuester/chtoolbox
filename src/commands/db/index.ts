import { Command } from '@effect/cli';
import { inspect } from './inspect';
import { replicate } from './replicate';
import { create } from './create';

export const db = Command
  .make('db', {})
  .pipe(
    Command.withDescription(`Manage Couch databases.`),
    Command.withSubcommands([create, inspect, replicate])
  );
