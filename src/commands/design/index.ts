import { Command } from '@effect/cli';
import { inspect } from './inspect';

export const design = Command
  .make('design', {})
  .pipe(
    Command.withDescription(`Manage Couch database designs.`),
    Command.withSubcommands([inspect])
  );
