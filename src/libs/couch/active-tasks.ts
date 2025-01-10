import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { ChtClientService } from '../../services/cht-client';
import { Array, Effect, Number, Option, Order, pipe, Record, Schedule, Schema, Stream, String } from 'effect';

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
  taskStream: CouchActiveTaskStream
): CouchActiveTaskStream => taskStream.pipe(Stream.map(Array.filter(taskHasType(types))));

const orderByStartedOn = Order.make(
  (a: CouchActiveTask, b: CouchActiveTask) => Number.Order(a.started_on, b.started_on)
);

const activeTasks = ChtClientService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  Effect.flatMap(CouchActiveTask.decodeResponse),
  Effect.scoped,
  Effect.map(Array.sort(orderByStartedOn)),
);

export const getActiveTasks = (): Effect.Effect<CouchActiveTask[], Error, ChtClientService> => activeTasks;

export type CouchActiveTaskStream = Stream.Stream<CouchActiveTask[], Error, ChtClientService>;

export const streamActiveTasks = (interval = 1000): CouchActiveTaskStream => Stream.repeat(
  activeTasks,
  Schedule.spaced(interval)
);
