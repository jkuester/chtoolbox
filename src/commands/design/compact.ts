import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { CompactService } from '../../services/compact.ts';
import { mergeArrayStreams } from '../../libs/core.ts';
import { streamActiveTasks } from '../db/compact.ts';

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database with the design to compact'),
  );

const designs = Args
  .text({ name: 'design' })
  .pipe(
    Args.withDescription('The design(s) to compact'),
    Args.atLeast(1),
  );

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'),
  );

export const compact = Command
  .make('compact', { follow, database, designs }, Effect.fn(({ follow, database, designs }) => pipe(
    CompactService.compactDesign(database),
    Effect.map(compactDesign => Array.map(designs, compactDesign)),
    Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
    Effect.map(Option.liftPredicate(() => follow)),
    Effect.map(Option.map(mergeArrayStreams)),
    Effect.map(Option.map(streamActiveTasks)),
    Effect.flatMap(Option.getOrElse(() => Console.log(
      'Compaction started. Watch the active tasks for progress: chtx active-tasks -f'
    ))),
  )))
  .pipe(Command.withDescription(
    `Run compaction on one or more Couch designs. `
    + `The \`db compact\` command can be used to compact entire databases.`
  ));
