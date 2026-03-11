import { Command } from '@effect/cli';
import { format } from './format.ts';

export const form = Command
  .make('form', {})
  .pipe(
    Command.withDescription('Manage CHT forms.'),
    Command.withSubcommands([format])
  );
