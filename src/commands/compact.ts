import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { initializeUrl } from '../index';
import { CompactService } from '../services/compact';

const currentlyCompacting = CompactService.pipe(
  Effect.delay(1000),
  Effect.flatMap(service => service.currentlyCompacting()),
  Effect.tap(Console.log('Currently compacting:')),
  Effect.tap(Console.log),
);

let noCompactingCount = 0;
const compactingComplete = (compacting: string[]) => pipe(
  compacting,
  Array.length,
  Option.liftPredicate(length => length === 0),
  Option.map(() => noCompactingCount += 1),
  Option.getOrElse(() => noCompactingCount = 0),
  count => count === 3,
);

const followCompacting = Effect
  .repeat(currentlyCompacting, { until: compactingComplete })
  .pipe(Effect.tap(Console.log('Compaction complete.')));

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'),
    Options.withDefault(false),
  );

export const compact = Command
  .make('compact', { follow }, ({ follow }) => initializeUrl.pipe(
    Effect.tap(Console.log('Compacting all dbs and views...')),
    Effect.andThen(CompactService),
    Effect.flatMap(compactService => compactService.compactAll()),
    Effect.andThen(() => followCompacting.pipe(
      Option.liftPredicate(() => follow),
      Option.getOrElse(() => Console.log(
        'Compaction started. Watch the active tasks for progress: chtx active-tasks'
      )),
    )),
  ))
  .pipe(Command.withDescription(`Force compaction on databases and views.`));
