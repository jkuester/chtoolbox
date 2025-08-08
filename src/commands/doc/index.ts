import { Command } from '@effect/cli';
import { generate } from './generate.ts';
import { purge } from './purge.ts';
import { replicate } from './replicate.ts';

export const doc = Command
  .make('doc', {})
  .pipe(
    Command.withDescription(`Manage Couch documents.`),
    Command.withSubcommands([generate, purge, replicate])
  );
