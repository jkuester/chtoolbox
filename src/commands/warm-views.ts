import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe, Schedule } from 'effect';
import { initializeUrl } from '../index';
import { WarmViewsService } from '../services/warm-views';

const designsCurrentlyUpdating = WarmViewsService.pipe(
  Effect.flatMap(service => service.designsCurrentlyUpdating()),
  Effect.map(Array.map(({ dbName, designId }) => `${dbName}/${designId}`)),
  Effect.tap(Console.log('Designs currently updating:')),
  Effect.tap(Console.log),
);

let noViewsWarmingCount = 0;
const viewWarmingComplete = (designsUpdating: string[]) => pipe(
  designsUpdating,
  Array.length,
  Option.liftPredicate(length => length === 0),
  Option.map(() => noViewsWarmingCount += 1),
  Option.getOrElse(() => noViewsWarmingCount = 0),
  count => count === 3,
);

const repeatSchedule = Schedule
  .recurUntil(viewWarmingComplete)
  .pipe(Schedule.delayed(() => 1000));

const followIndexing = Effect
  .repeat(designsCurrentlyUpdating, repeatSchedule)
  .pipe(Effect.tap(Console.log('View warming complete.')));

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering warming, wait for all indexing jobs to complete.'),
    Options.withDefault(false),
  );

export const warmViews = Command
  .make('warm-views', { follow }, ({ follow }) => pipe(
    initializeUrl,
    Effect.tap(Console.log('Warming views...')),
    Effect.andThen(Effect.flatMap(WarmViewsService, warmViewsService => warmViewsService.warmAll())),
    Effect.andThen(() => followIndexing.pipe(
      Option.liftPredicate(() => follow),
      Option.getOrElse(() => Console.log(
        'View warming started. Watch the active tasks for progress: chtx active-tasks'
      )),
    )),
  ))
  .pipe(Command.withDescription(`Warm all view indexes.`));
