import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option } from 'effect';
import { initializeUrl } from '../../index';
import { CompactService } from '../../services/compact';
import { streamActiveTasks } from '../compact';
import { mergeArrayStreams } from '../../libs/core';

const compactDb = (dbName: string) => Effect.flatMap(CompactService, svc => svc.compactDb(dbName));

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database to compact'),
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
  .make('compact', { follow, databases }, ({ follow, databases }) => initializeUrl.pipe(
    Effect.andThen(() => Array.map(databases, compactDb)),
    Effect.flatMap(Effect.all),
    Effect.map(Option.liftPredicate(() => follow)),
    Effect.map(Option.map(mergeArrayStreams)),
    Effect.map(Option.map(streamActiveTasks)),
    Effect.flatMap(Option.getOrElse(() => Console.log(
      'Compaction started. Watch the active tasks for progress: chtx active-tasks'
    ))),
  ))
  .pipe(Command.withDescription(`Display detailed information on one or more Couch databases`));
