"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouchActiveTasksServiceLive = exports.CouchActiveTasksService = exports.filterStreamByType = exports.getDisplayDictByPid = exports.getProgressPct = exports.getPid = exports.getDbName = exports.getDesignName = exports.CouchActiveTask = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const couch_1 = require("./couch");
const effect_1 = require("effect");
const ENDPOINT = '/_active_tasks';
class CouchActiveTask extends Schema.Class('CouchActiveTask')({
    database: Schema.String,
    design_document: Schema.UndefinedOr(Schema.String),
    doc_id: Schema.UndefinedOr(Schema.String),
    docs_written: Schema.UndefinedOr(Schema.Number),
    pid: Schema.String,
    progress: Schema.UndefinedOr(Schema.Number),
    started_on: Schema.Number,
    type: Schema.String,
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(Schema.Array(CouchActiveTask));
}
exports.CouchActiveTask = CouchActiveTask;
const getDesignName = (task) => effect_1.Option
    .fromNullable(task.design_document)
    .pipe(effect_1.Option.flatMap(effect_1.String.match(/^_design\/(.*)$/)), effect_1.Option.flatMap(effect_1.Array.get(1)));
exports.getDesignName = getDesignName;
const getDbName = (task) => (0, effect_1.pipe)(task.database, effect_1.String.match(/^.+\/.+\/([^.]+)\..+/), effect_1.Option.flatMap(effect_1.Array.get(1)), effect_1.Option.getOrThrow);
exports.getDbName = getDbName;
const getPid = (task) => (0, effect_1.pipe)(task.pid, effect_1.String.slice(1, -1));
exports.getPid = getPid;
const getProgressPct = (task) => effect_1.Option
    .fromNullable(task.progress)
    .pipe(effect_1.Option.map(progress => `${progress.toString()}%`), effect_1.Option.getOrElse(() => effect_1.String.empty));
exports.getProgressPct = getProgressPct;
const removePid = effect_1.Record.remove('pid');
const addByPid = (task) => effect_1.Record.set(task.pid, removePid(task));
const buildDictByPid = (dict, task) => (0, effect_1.pipe)(dict, addByPid(task));
const getDisplayDictByPid = (tasks) => effect_1.Array.reduce(tasks, {}, buildDictByPid);
exports.getDisplayDictByPid = getDisplayDictByPid;
const taskHasType = (types) => (task) => (0, effect_1.pipe)(types, effect_1.Array.contains(task.type));
const filterStreamByType = (...types) => (taskStream) => taskStream.pipe(effect_1.Stream.map(effect_1.Array.filter(taskHasType(types))));
exports.filterStreamByType = filterStreamByType;
const orderByStartedOn = effect_1.Order.make((a, b) => effect_1.Number.Order(a.started_on, b.started_on));
const activeTasks = couch_1.CouchService.pipe(Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(ENDPOINT))), Effect.flatMap(CouchActiveTask.decodeResponse), Effect.scoped, Effect.map(effect_1.Array.sort(orderByStartedOn)));
exports.CouchActiveTasksService = Context.GenericTag('chtoolbox/CouchActiveTasksService');
const ServiceContext = couch_1.CouchService.pipe(Effect.map(couch => Context.make(couch_1.CouchService, couch)));
exports.CouchActiveTasksServiceLive = Layer.effect(exports.CouchActiveTasksService, ServiceContext.pipe(Effect.map(context => exports.CouchActiveTasksService.of({
    get: () => activeTasks.pipe(Effect.provide(context)),
    stream: (interval = 1000) => effect_1.Stream.repeat(activeTasks.pipe(Effect.provide(context)), effect_1.Schedule.spaced(interval)),
}))));
//# sourceMappingURL=active-tasks.js.map