import { Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Number, Option, pipe, Stream, String } from 'effect';
import { initializeUrl } from '../index';
import {
  CouchActiveTask,
  CouchActiveTasksService,
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
  type: task.type,
  database: `${getDbName(task)}${getDesignDisplayName(task)}`,
  pid: getPid(task),
  progress: getProgressPct(task),
  started_at: DateTime
    .unsafeMake(Number.multiply(task.started_on, 1000))
    .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
});

const getPrintableTasks = (tasks: CouchActiveTask[]) => pipe(
  tasks,
  Option.liftPredicate(Array.isNonEmptyArray),
  Option.map(Array.map(getTaskDisplayData)),
  Option.map(getDisplayDictByPid),
  Option.getOrElse(() => 'No active tasks.'),
);

const printCurrentTasks = CouchActiveTasksService.pipe(
  Effect.flatMap(service => service.get()),
  Effect.map(getPrintableTasks),
  Effect.tap(Console.table),
);

const followActiveTasks = CouchActiveTasksService.pipe(
  Effect.map(svc => svc.stream()),
  Effect.flatMap(Stream.runForEach(tasks => Effect
    .succeed(getPrintableTasks(tasks))
    .pipe(
      Effect.tap(Console.clear),
      Effect.tap(Console.table),
    ))),
);

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('Continuously poll the active tasks.'),
    Options.withDefault(false),
  );

export const activeTasks = Command
  .make('active-tasks', { follow }, ({ follow }) => initializeUrl.pipe(
    Effect.andThen(followActiveTasks),
    Option.liftPredicate(() => follow),
    Option.getOrElse(() => printCurrentTasks),
  ))
  .pipe(Command.withDescription(`Force compaction on databases and views.`));
