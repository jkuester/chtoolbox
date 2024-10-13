import { Command } from '@effect/cli';
import { inspect } from './inspect';
import { compact } from './compact';
import { ls } from './ls';

export const design = Command
  .make('design', {})
  .pipe(
    Command.withDescription(`Manage Couch database designs.`),
    Command.withSubcommands([compact, inspect, ls])
  );
