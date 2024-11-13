import { Command } from '@effect/cli';
import { generate } from './generate';
import { purge } from './purge';
import { replicate } from './replicate';

export const doc = Command
  .make('doc', {})
  .pipe(
    Command.withDescription(`Manage Couch documents.`),
    Command.withSubcommands([generate, purge, replicate])
  );
