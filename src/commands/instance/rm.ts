import { Args, Command, Options, Prompt } from '@effect/cli';
import { Array, Console, Effect, Match, Option, pipe } from 'effect';
import { LocalInstanceService } from '../../services/local-instance.js';

const getConfirmationPrompt = (names: string[]) => Prompt.confirm({
  message: `Are you sure you want to permanently remove ${Array.join(names, ', ')}?`,
  initial: false,
});

const isRemoveConfirmed = (names: string[], yes: boolean) => Match
  .value(yes)
  .pipe(
    Match.when(true, () => Effect.succeed(true)),
    Match.orElse(() => getConfirmationPrompt(names)),
  );

const rmChtInstances = (names: string[]) => pipe(
  names,
  Array.map(LocalInstanceService.rm),
  Effect.all,
  Effect.andThen(Console.log('CHT instance(s) removed')),
);

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
  );

const names = Args
  .text({ name: 'name' })
  .pipe(
    Args.withDescription('The project name of the CHT instance to remove'),
    Args.atLeast(1),
  );

export const rm = Command
  .make('rm', { names, yes }, ({ names, yes }) => isRemoveConfirmed(names, yes)
    .pipe(
      Effect.map(removeConfirmed => Option.liftPredicate(rmChtInstances(names), () => removeConfirmed)),
      Effect.flatMap(Option.getOrElse(() => Console.log('Operation cancelled'))),
    ))
  .pipe(Command.withDescription(
    'LOCAL ONLY: Remove a local CHT instance, completely deleting all associated data. ' +
    'If the data for this instance was mapped to a local directory when the instance was created (via the ' +
    '--directory flag) this data will NOT be deleted. Requires Docker and Docker Compose.'
  ));
