import { Command } from '@effect/cli';
import { create } from './create.js';
import { ls } from './ls.js';
import { rm } from './rm.js';

export const localIp = Command
  .make('local-ip', {})
  .pipe(
    Command.withDescription(`Manage nginx-local-ip instances.`),
    Command.withSubcommands([create, ls, rm])
  );
