import { Command } from '@effect/cli';
import { create } from './create.ts';
import { rm } from './rm.ts';
import { stop } from './stop.ts';
import { start } from './start.ts';
import { setSSL } from './set-ssl.ts';
import { ls } from './ls.ts';

export const instance = Command
  .make('instance', {})
  .pipe(
    Command.withDescription(`Manage CHT instances.`),
    Command.withSubcommands([create, ls, setSSL, start, stop, rm])
  );
