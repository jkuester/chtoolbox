import { Args, Command, Options, Prompt } from '@effect/cli';
import { Boolean, Console, Effect, Option, pipe } from 'effect';
import { color } from '../../libs/console.ts';
import { initializeUrl } from '../../index.ts';
import { SentinelBacklogService } from '../../services/sentinel-backlog.ts';

const validateParams = Effect.fn((value: Option.Option<string>, latest: boolean) => pipe(
  value,
  Option.isSome,
  Boolean.xor(latest),
  Effect.succeed,
  Effect.filterOrFail(
    valid => valid,
    () => new Error('Must provide either the --latest flag or a value argument (but not both).')
  )
));

const getNewSequenceValue = Effect.fn((value: Option.Option<string>) => pipe(
  value,
  Option.map(Effect.succeed),
  Option.getOrElse(() => SentinelBacklogService.getMedicUpdateSeq()),
));

const getConfirmationPrompt = (currentTransitionSeq: string, newTransitionSeq: string) => Prompt.confirm({
  message: `You are about to update the Sentinel transition sequence:
  
Current value: ${pipe(currentTransitionSeq, color('green'))}
New value: ${pipe(newTransitionSeq, color('green'))}  

Are you sure you want to make this update?`,
  initial: false,
});
const isRemoveConfirmed = Effect.fn((yes: boolean, currentTransitionSeq: string, newTransitionSeq: string) => Effect
  .succeed(true)
  .pipe(Effect.filterOrElse(
    () => yes,
    () => getConfirmationPrompt(currentTransitionSeq, newTransitionSeq),
  )));

const value = Args
  .text({ name: 'value' })
  .pipe(
    Args.withDescription(
      'The sequence value to set. This is the target update-seq value from the medic database. '
      + 'Required when --latest is not set.'
    ),
    Args.optional,
  );

const latest = Options
  .boolean('latest')
  .pipe(
    Options.withDescription(
      'Set the Sentinel transitions sequence value to the current update-seq value from the medic database. '
      + 'Cannot be used when providing a value argument.'
    ),
  );

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
  );

export const setSequence = Command
  .make('set-sequence', { value, latest, yes }, ({ value, latest, yes }) => initializeUrl.pipe(
    Effect.andThen(validateParams(value, latest)),
    Effect.andThen(Effect.all([
      SentinelBacklogService.getTransitionsSeq(),
      getNewSequenceValue(value)
    ], { concurrency: 'unbounded' })),
    Effect.flatMap(([currentSeq, newSeq]) => pipe(
      isRemoveConfirmed(yes, currentSeq, newSeq),
      Effect.map(removeConfirmed => Option.liftPredicate(
        SentinelBacklogService.setTransitionsSeq(newSeq),
        () => removeConfirmed
      )),
      Effect.flatMap(Option.getOrElse(() => Console.log('Operation cancelled'))),
    ))
  ))
  .pipe(Command.withDescription(
    'Update the Sentinel transitions sequence value. The Sentinel container should be stopped before '
    + 'performing this operation and then started again once the update is complete.'
  ));
