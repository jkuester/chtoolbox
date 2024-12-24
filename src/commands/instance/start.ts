import { Args, Command } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { LocalInstanceService } from '../../services/local-instance';
import { printInstanceInfo } from './create';

const startChtInstances = (names: string[]) => pipe(
  names,
  Array.map(LocalInstanceService.start),
  Effect.all,
);

const names = Args
  .text({ name: 'name' })
  .pipe(
    Args.withDescription('The project name of the CHT instance to start'),
    Args.atLeast(1),
  );

export const start = Command
  .make('start', { names }, ({ names }) => startChtInstances(names)
    .pipe(Effect.flatMap(printInstanceInfo(names))))
  .pipe(Command.withDescription(
    'LOCAL ONLY: Start a local CHT instance. The instance must already have been created. ' +
    'Requires Docker and Docker Compose.'
  ));
