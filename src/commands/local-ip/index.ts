import { Command } from '@effect/cli';
import { create } from './create.ts';
import { ls } from './ls.ts';
import { rm } from './rm.ts';

export const localIp = Command
  .make('local-ip', {})
  .pipe(
    Command.withDescription(`Manage nginx-local-ip instances.`),
    Command.withSubcommands([create, ls, rm])
  );
