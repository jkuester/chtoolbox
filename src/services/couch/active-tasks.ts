import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
import { Array, Number, Option, Order, pipe, Record, Schedule, Stream, String } from 'effect';
import { DurationInput } from 'effect/Duration';

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

export interface CouchActiveTasksService {
  readonly get: () => Effect.Effect<CouchActiveTask[], Error>
  readonly stream: (interval?: DurationInput) => Stream.Stream<CouchActiveTask[], Error>
}

export const getDesignName = (task: CouchActiveTask) => Option
  .fromNullable(task.design_document)
  .pipe(
    Option.flatMap(String.match(/^_design\/(.*)$/)),
    Option.flatMap(Array.get(1)),
  );

export const getDbName = (task: CouchActiveTask) => pipe(
  task.database,
  String.match(/^.+\/.+\/([^.]+)\..+/),
  Option.flatMap(Array.get(1)),
  Option.getOrThrow,
);

export const getPid = (task: CouchActiveTask) => pipe(
  task.pid,
  String.slice(1, -1),
);

export const getProgressPct = (task: CouchActiveTask) => Option
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
export const getDisplayDictByPid = (tasks: { pid: string }[]) => Array.reduce(tasks, {}, buildDictByPid);

const taskHasType = (types: string[]) => (task: CouchActiveTask) => pipe(
  types,
  Array.contains(task.type),
);
export const filterStreamByType = (...types: string[]) => (
  taskStream: Stream.Stream<CouchActiveTask[], Error>
) => taskStream.pipe(Stream.map(Array.filter(taskHasType(types))));

const orderByStartedOn = Order.make(
  (a: CouchActiveTask, b: CouchActiveTask) => Number.Order(a.started_on, b.started_on)
);

const activeTasks = CouchService.pipe(
  Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))),
  Effect.flatMap(CouchActiveTask.decodeResponse),
  Effect.scoped,
  Effect.map(Array.sort(orderByStartedOn)),
);

export const CouchActiveTasksService = Context.GenericTag<CouchActiveTasksService>('chtoolbox/CouchActiveTasksService');

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchActiveTasksServiceLive = Layer.effect(CouchActiveTasksService, ServiceContext.pipe(Effect.map(
  context => CouchActiveTasksService.of({
    get: () => activeTasks.pipe(Effect.provide(context)),
    stream: (interval = 1000) => Stream.repeat(
      activeTasks.pipe(Effect.provide(context)),
      Schedule.spaced(interval)
    ),
  }),
)));
