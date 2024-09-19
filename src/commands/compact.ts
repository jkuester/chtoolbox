import { Command } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { initializeUrl } from '../index';
import { CompactService } from '../services/compact';

const currentlyCompacting = CompactService.pipe(
  Effect.delay(1000),
  Effect.flatMap(service => service.currentlyCompacting),
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

export const compact = Command
  .make('compact', {}, () => initializeUrl.pipe(
    Effect.tap(Console.log('Compacting all dbs and views...')),
    Effect.andThen(CompactService),
    Effect.flatMap(compactService => compactService.compactAll),
    Effect.andThen(Effect.repeat(currentlyCompacting, { until: compactingComplete })),
    Effect.tap(Console.log('Compaction complete.')),
  ))
  .pipe(Command.withDescription(`Force compaction on databases and views.`));
