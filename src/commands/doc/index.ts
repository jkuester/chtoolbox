import { Command } from '@effect/cli';
import { purge } from './purge';
import { replicate } from './replicate';

export const doc = Command
  .make('doc', {})
  .pipe(
    Command.withDescription(`Manage Couch documents.`),
    Command.withSubcommands([purge, replicate])
  );
