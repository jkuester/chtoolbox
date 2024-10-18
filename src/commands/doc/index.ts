import { Command } from '@effect/cli';
import { purge } from './purge';

export const doc = Command
  .make('doc', {})
  .pipe(
    Command.withDescription(`Manage Couch documents.`),
    Command.withSubcommands([purge])
  );
