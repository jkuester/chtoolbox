import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe, String, Stream } from 'effect';
import { initializeUrl } from '../../index';
import { CompactService } from '../../services/compact';
import { mergeArrayStreams } from '../../libs/core';
import {
  CouchActiveTask,
  getDbName,
  getDesignName,
  getDisplayDictByPid,
  getPid,
  getProgressPct
} from '../../services/couch/active-tasks';

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

const compactAll = (compactDesigns: boolean) => CompactService
  .compactAll(compactDesigns)
  .pipe(Effect.map(Array.make));

const doCompaction = (databases: string[], all: boolean) => pipe(
  databases,
  Option.liftPredicate(Array.isNonEmptyArray),
  Option.map(Array.map(dbName => CompactService.compactDb(dbName, all))),
  Option.map(Effect.all),
  Option.getOrElse(() => compactAll(all)),
  x => x,
);

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database(s) to compact. Leave empty to compact all databases.'),
    Args.atLeast(0),
  );

const all = Options
  .boolean('all')
  .pipe(
    Options.withAlias('a'),
    Options.withDescription('Also compact all of the designs for the database(s).'),
    Options.withDefault(false),
  );

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'),
    Options.withDefault(false),
  );

export const compact = Command
  .make('compact', { follow, databases, all }, ({ follow, databases, all }) => initializeUrl.pipe(
    Effect.andThen(() => doCompaction(databases, all)),
    Effect.map(Option.liftPredicate(() => follow)),
    Effect.map(Option.map(mergeArrayStreams)),
    Effect.map(Option.map(streamActiveTasks)),
    Effect.flatMap(Option.getOrElse(() => Console.log(
      'Compaction started. Watch the active tasks for progress: chtx active-tasks -f'
    ))),
  ))
  .pipe(Command.withDescription(`Run compaction on one or more Couch databases`));
