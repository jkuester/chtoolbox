import { Command } from '@effect/cli';
import { inspect } from './inspect.ts';
import { compact } from './compact.ts';
import { ls } from './ls.ts';

export const design = Command
  .make('design', {})
  .pipe(
    Command.withDescription(`Manage Couch database designs.`),
    Command.withSubcommands([compact, inspect, ls])
  );
