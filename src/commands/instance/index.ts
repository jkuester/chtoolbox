import { Command } from '@effect/cli';
import { create } from './create.js';
import { rm } from './rm.js';
import { stop } from './stop.js';
import { start } from './start.js';
import { setSSL } from './set-ssl.js';
import { ls } from './ls.js';

export const instance = Command
  .make('instance', {})
  .pipe(
    Command.withDescription(`Manage CHT instances.`),
    Command.withSubcommands([create, ls, setSSL, start, stop, rm])
  );
