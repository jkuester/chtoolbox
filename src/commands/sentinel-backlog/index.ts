import { Command } from '@effect/cli';
import { ls } from './ls.ts';
import { setSequence } from './set-sequence.ts';

export const sentinelBacklog = Command
  .make('sentinel-backlog', {})
  .pipe(
    Command.withDescription(`Manage Sentinel backlog.`),
    Command.withSubcommands([ls, setSequence])
  );
