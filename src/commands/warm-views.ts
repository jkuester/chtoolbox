import { Command } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { initializeUrl } from '../index';
import { WarmViewsService } from '../services/warm-views';

const designsCurrentlyUpdating = WarmViewsService.pipe(
  Effect.delay(1000),
  Effect.flatMap(service => service.designsCurrentlyUpdating),
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

export const warmViews = Command
  .make('warm-views', {}, () => pipe(
    initializeUrl,
    Effect.tap(Console.log('Warming views...')),
    Effect.andThen(WarmViewsService),
    Effect.flatMap(warmViewsService => warmViewsService.warmAll),
    Effect.andThen(Effect.repeat(designsCurrentlyUpdating, { until: viewWarmingComplete })),
    Effect.tap(Console.log('View warming complete.')),
  ))
  .pipe(Command.withDescription(`Warm all view indexes.`));
