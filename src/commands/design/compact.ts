import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option } from 'effect';
import { initializeUrl } from '../../index';
import { CompactService } from '../../services/compact';
import { streamActiveTasks } from '../compact';
import { mergeArrayStreams } from '../../libs/core';

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database with the design to compact'),
  );

const designs = Args
  .text({ name: 'design' })
  .pipe(
    Args.withDescription('The design to compact'),
    Args.atLeast(1),
  );

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'),
    Options.withDefault(false),
  );

export const compact = Command
  .make('compact', { follow, database, designs }, ({ follow, database, designs }) => initializeUrl.pipe(
    Effect.andThen(CompactService.compactDesign(database)),
    Effect.map(compactDesign => Array.map(designs, compactDesign)),
    Effect.flatMap(Effect.all),
    Effect.map(Option.liftPredicate(() => follow)),
    Effect.map(Option.map(mergeArrayStreams)),
    Effect.map(Option.map(streamActiveTasks)),
    Effect.flatMap(Option.getOrElse(() => Console.log(
      'Compaction started. Watch the active tasks for progress: chtx active-tasks -f'
    ))),
  ))
  .pipe(Command.withDescription(`Run compaction on one or more Couch designs`));
