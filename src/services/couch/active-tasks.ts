import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { ChtClientService } from '../cht-client';
import { Array, Number, Option, Order, pipe, Record, Schedule, Schema, Stream, String, Effect } from 'effect';

const ENDPOINT = '/_active_tasks';

export class CouchActiveTask extends Schema.Class<CouchActiveTask>('CouchActiveTask')({
  database: Schema.String,
  design_document: Schema.UndefinedOr(Schema.String),
  doc_id: Schema.UndefinedOr(Schema.String),
  docs_written: Schema.UndefinedOr(Schema.Number),
  pid: Schema.String,
  progress: Schema.UndefinedOr(Schema.Number),
  started_on: Schema.Number,
  type: Schema.String,
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(Schema.Array(CouchActiveTask));
}

export const getDesignName = (task: CouchActiveTask): Option.Option<string> => Option
  .fromNullable(task.design_document)
  .pipe(
    Option.flatMap(String.match(/^_design\/(.*)$/)),
    Option.flatMap(Array.get(1)),
  );

export const getDbName = (task: CouchActiveTask): string => pipe(
  task.database,
  String.match(/^.+\/.+\/([^.]+)\..+/),
  Option.flatMap(Array.get(1)),
  Option.getOrThrow,
);

export const getPid = (task: CouchActiveTask): string => pipe(
  task.pid,
  String.slice(1, -1),
);

export const getProgressPct = (task: CouchActiveTask): string => Option
  .fromNullable(task.progress)
  .pipe(
    Option.map(progress => `${progress.toString()}%`),
    Option.getOrElse(() => String.empty),
  );

const removePid = Record.remove('pid');
const addByPid = (task: { pid: string }) => Record.set(task.pid, removePid(task));
const buildDictByPid = (dict: Record<string, Record<string, string>>, task: { pid: string }) => pipe(
  dict,
  addByPid(task),
);
export const getDisplayDictByPid = (
  tasks: { pid: string }[]
): Record<string, Record<string, string>> => Array.reduce(tasks, {}, buildDictByPid);

const taskHasType = (types: string[]) => (task: CouchActiveTask) => pipe(
  types,
  Array.contains(task.type),
);
export const filterStreamByType = (...types: string[]) => (
  taskStream: Stream.Stream<CouchActiveTask[], Error>
): Stream.Stream<CouchActiveTask[], Error> => taskStream.pipe(Stream.map(Array.filter(taskHasType(types))));

const orderByStartedOn = Order.make(
  (a: CouchActiveTask, b: CouchActiveTask) => Number.Order(a.started_on, b.started_on)
);

const activeTasks = ChtClientService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  Effect.flatMap(CouchActiveTask.decodeResponse),
  Effect.scoped,
  Effect.map(Array.sort(orderByStartedOn)),
);

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export type CouchActiveTaskStream = Stream.Stream<CouchActiveTask[], Error>;

export class CouchActiveTasksService extends Effect.Service<CouchActiveTasksService>()(
  'chtoolbox/CouchActiveTasksService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      get: (): Effect.Effect<CouchActiveTask[], Error> => activeTasks.pipe(Effect.provide(context)),
      stream: (interval = 1000): CouchActiveTaskStream => Stream.repeat(
        activeTasks.pipe(Effect.provide(context)),
        Schedule.spaced(interval)
      ),
    }))),
    accessors: true,
  }
) {
}

