import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, Stream, String } from 'effect';
import { initializeUrl } from '../index';
import { CompactService } from '../services/compact';
import {
  CouchActiveTask,
  getDbName,
  getDesignName,
  getDisplayDictByPid,
  getPid,
  getProgressPct
} from '../services/couch/active-tasks';

const getDesignDisplayName = (task: CouchActiveTask) => getDesignName(task)
  .pipe(
    Option.map(design => `/${design}`),
    Option.getOrElse(() => String.empty),
  );

const getTaskDisplayData = (task: CouchActiveTask) => ({
  database: `${getDbName(task)}${getDesignDisplayName(task)}`,
  pid: getPid(task),
  progress: getProgressPct(task),
});

export const streamActiveTasks = (taskStream: Stream.Stream<CouchActiveTask[], Error>) => taskStream.pipe(
  Stream.map(Array.map(getTaskDisplayData)),
  Stream.map(getDisplayDictByPid),
  Stream.runForEach(taskDict => Console.clear.pipe(
    Effect.tap(Console.log('Currently compacting:')),
    Effect.tap(Console.table(taskDict)),
  )),
  Effect.tap(Console.clear.pipe(
    Effect.tap(Console.log('Compaction complete.')),
  )),
);

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
    Effect.map(Option.liftPredicate(() => follow)),
    Effect.map(Option.map(streamActiveTasks)),
    Effect.flatMap(Option.getOrElse(() => Console.log(
      'Compaction started. Watch the active tasks for progress: chtx active-tasks'
    ))),
  ))
  .pipe(Command.withDescription(`Force compaction on databases and views.`));
