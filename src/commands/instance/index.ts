import { Command } from '@effect/cli';
import { create } from './create';
import { rm } from './rm';
import { stop } from './stop';
import { start } from './start';
import { setSSL } from './set-ssl';
import { ls } from './ls';

export const instance = Command
  .make('instance', {})
  .pipe(
    Command.withDescription(`Manage CHT instances.`),
    Command.withSubcommands([create, ls, setSSL, start, stop, rm])
  );
