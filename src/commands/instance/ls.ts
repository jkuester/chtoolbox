import { Command } from '@effect/cli';
import { Console, Effect, Array } from 'effect';
import { LocalInstanceService } from '../../services/local-instance';

export const ls = Command
  .make('ls', {}, () => LocalInstanceService
    .ls()
    .pipe(
      Effect.map(Array.map(name => Console.log(name))),
      Effect.flatMap(Effect.all),
    ))
  .pipe(Command.withDescription(
    `LOCAL ONLY: List the local CHT instances. Requires Docker and Docker Compose.`
  ));
