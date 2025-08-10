import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { ChtClientService } from "../../services/cht-client.js";
import { Array, Effect, Number, Option, Order, pipe, Record, Schedule, Schema, Stream, String } from 'effect';
const ENDPOINT = '/_active_tasks';
export class CouchActiveTask extends Schema.Class('CouchActiveTask')({
    database: Schema.String,
    design_document: Schema.UndefinedOr(Schema.String),
    doc_id: Schema.UndefinedOr(Schema.String),
    docs_written: Schema.UndefinedOr(Schema.Number),
    pid: Schema.String,
    progress: Schema.UndefinedOr(Schema.Number),
    started_on: Schema.Number,
    type: Schema.String,
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(Schema.Array(CouchActiveTask));
}
export const getDesignName = (task) => Option
    .fromNullable(task.design_document)
    .pipe(Option.flatMap(String.match(/^_design\/(.*)$/)), Option.flatMap(Array.get(1)));
export const getDbName = (task) => pipe(task.database, String.match(/^.+\/.+\/([^.]+)\..+/), Option.flatMap(Array.get(1)), Option.getOrThrow);
export const getPid = (task) => pipe(task.pid, String.slice(1, -1));
export const getProgressPct = (task) => Option
    .fromNullable(task.progress)
    .pipe(Option.map(progress => `${progress.toString()}%`), Option.getOrElse(() => String.empty));
const removePid = Record.remove('pid');
const addByPid = (task) => Record.set(task.pid, removePid(task));
const buildDictByPid = (dict, task) => pipe(dict, addByPid(task));
export const getDisplayDictByPid = (tasks) => Array.reduce(tasks, {}, buildDictByPid);
const taskHasType = (types) => (task) => pipe(types, Array.contains(task.type));
export const filterStreamByType = (...types) => (taskStream) => taskStream.pipe(Stream.map(Array.filter(taskHasType(types))));
const orderByStartedOn = Order.make((a, b) => Number.Order(a.started_on, b.started_on));
const activeTasks = ChtClientService.pipe(Effect.flatMap(couch => couch.request(HttpClientRequest.get(ENDPOINT))), Effect.flatMap(CouchActiveTask.decodeResponse), Effect.scoped, Effect.map(Array.sort(orderByStartedOn)));
export const getActiveTasks = Effect.fn(() => activeTasks);
export const streamActiveTasks = (interval = 1000) => Stream.repeat(activeTasks, Schedule.spaced(interval));
