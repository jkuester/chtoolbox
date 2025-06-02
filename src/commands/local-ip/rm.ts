import { Args, Command } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { LocalIpService } from '../../services/local-ip.js';

const toPorts = Args
  .integer({ name: 'to' })
  .pipe(
    Args.withDescription('The port the local-ip instance to be removed is proxying requests to.'),
    Args.atLeast(1),
  );

export const rm = Command
  .make('rm', { toPorts }, ({ toPorts }) => pipe(
    toPorts,
    Array.map(LocalIpService.rm),
    Effect.all,
    Effect.andThen(Console.log('Nginx-local-ip instance(s) removed')),
  ))
  .pipe(Command.withDescription(
    'LOCAL ONLY: Remove an nginx-local-ip instance. Requires Docker.'
  ));
