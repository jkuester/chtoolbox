import { Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Number, Option, Order, pipe, Record, Schedule } from 'effect';
import { initializeUrl } from '../index';
import { CouchActiveTask, CouchActiveTasksService } from '../services/couch/active-tasks';

const getDbNameFromShard = (shard: string) => shard.split('/')[2].split('.')[0];
const getDesignName = (design_document?: string) => Option
  .fromNullable(design_document)
  .pipe(
    Option.map(d => `/${d.split('/')[1]}`),
    Option.getOrElse(() => ''),
  );

const getTaskDisplayData = ({
  type,
  database,
  design_document,
  pid,
  progress,
  started_on,
}: CouchActiveTask) => ({
  type,
  database: `${getDbNameFromShard(database)}${getDesignName(design_document)}`,
  pid: pid.substring(1, pid.length - 1),
  progress: `${progress?.toString() ?? '?'}%`,
  started_at: DateTime
    .unsafeMake(Number.multiply(started_on, 1000))
    .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
});

const getTasksDisplayData = (tasks: readonly CouchActiveTask[]) => pipe(
  Array.map(tasks, getTaskDisplayData),
  Array.reduce({}, (data, task) => Record.set(task.pid, Record.remove('pid')(task))(data)),
);

const orderByStartedOn = Order.make(
  (a: CouchActiveTask, b: CouchActiveTask) => Number.Order(a.started_on, b.started_on)
);

const couchActiveTasks = CouchActiveTasksService.pipe(
  Effect.flatMap(service => service.get()),
  Effect.map(Array.sort(orderByStartedOn)),
  Effect.map(Option.liftPredicate(Array.isNonEmptyArray)),
  Effect.map(Option.map(getTasksDisplayData)),
  Effect.map(Option.getOrElse(() => 'No active tasks.')),
);

const followActiveTasks = Effect.repeat(
  couchActiveTasks.pipe(
    Effect.flatMap(tasks => Console.clear.pipe(
      Effect.tap(Console.table(tasks)),
    )),
  ),
  Schedule.spaced(5000)
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
    Option.getOrElse(() => couchActiveTasks.pipe(Effect.tap(Console.table))),
  ))
  .pipe(Command.withDescription(`Force compaction on databases and views.`));
