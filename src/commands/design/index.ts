import { Command } from '@effect/cli';
import { inspect } from './inspect.ts';
import { compact } from './compact.ts';
import { ls } from './ls.ts';
import { diff } from './diff.ts';
import { upgrade } from './upgrade.ts';

export const design = Command
  .make('design', {})
  .pipe(
    Command.withDescription(`Manage Couch database designs.`),
    Command.withSubcommands([compact, diff, inspect, ls, upgrade])
  );
