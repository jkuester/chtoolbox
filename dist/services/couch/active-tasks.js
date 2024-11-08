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
exports.CouchActiveTasksService = exports.filterStreamByType = exports.getDisplayDictByPid = exports.getProgressPct = exports.getPid = exports.getDbName = exports.getDesignName = exports.CouchActiveTask = void 0;
const platform_1 = require("@effect/platform");
const Context = __importStar(require("effect/Context"));
const cht_client_1 = require("../cht-client");
const effect_1 = require("effect");
const ENDPOINT = '/_active_tasks';
class CouchActiveTask extends effect_1.Schema.Class('CouchActiveTask')({
    database: effect_1.Schema.String,
    design_document: effect_1.Schema.UndefinedOr(effect_1.Schema.String),
    doc_id: effect_1.Schema.UndefinedOr(effect_1.Schema.String),
    docs_written: effect_1.Schema.UndefinedOr(effect_1.Schema.Number),
    pid: effect_1.Schema.String,
    progress: effect_1.Schema.UndefinedOr(effect_1.Schema.Number),
    started_on: effect_1.Schema.Number,
    type: effect_1.Schema.String,
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(effect_1.Schema.Array(CouchActiveTask));
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
const activeTasks = cht_client_1.ChtClientService.pipe(effect_1.Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(ENDPOINT))), effect_1.Effect.flatMap(CouchActiveTask.decodeResponse), effect_1.Effect.scoped, effect_1.Effect.map(effect_1.Array.sort(orderByStartedOn)));
const serviceContext = cht_client_1.ChtClientService.pipe(effect_1.Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class CouchActiveTasksService extends effect_1.Effect.Service()('chtoolbox/CouchActiveTasksService', {
    effect: serviceContext.pipe(effect_1.Effect.map(context => ({
        get: () => activeTasks.pipe(effect_1.Effect.provide(context)),
        stream: (interval = 1000) => effect_1.Stream.repeat(activeTasks.pipe(effect_1.Effect.provide(context)), effect_1.Schedule.spaced(interval)),
    }))),
    accessors: true,
}) {
}
exports.CouchActiveTasksService = CouchActiveTasksService;
//# sourceMappingURL=active-tasks.js.map