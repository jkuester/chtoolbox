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
exports.CompactService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
const dbs_info_1 = require("./couch/dbs-info");
const design_docs_1 = require("./couch/design-docs");
const compact_1 = require("./couch/compact");
const design_info_1 = require("./couch/design-info");
const active_tasks_1 = require("./couch/active-tasks");
const core_1 = require("../libs/core");
const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';
const compactDb = (dbName) => compact_1.CouchCompactService.compactDb(dbName);
const compactDesign = (dbName) => (designName) => compact_1.CouchCompactService.compactDesign(dbName, designName);
const compactAll = dbs_info_1.CouchDbsInfoService
    .getDbNames()
    .pipe(Effect.tap(names => (0, effect_1.pipe)(names, effect_1.Array.map(compactDb), Effect.all)), Effect.map(effect_1.Array.map(dbName => design_docs_1.CouchDesignDocsService
    .getNames(dbName)
    .pipe(Effect.map(effect_1.Array.map(compactDesign(dbName))), Effect.flatMap(Effect.all)))), Effect.flatMap(Effect.all), Effect.andThen(Effect.void));
const ServiceContext = Effect
    .all([
    active_tasks_1.CouchActiveTasksService,
    dbs_info_1.CouchDbsInfoService,
    design_docs_1.CouchDesignDocsService,
    compact_1.CouchCompactService,
    design_info_1.CouchDesignInfoService,
])
    .pipe(Effect.map(([activeTasks, dbsInfo, designDocs, compact, designInfo]) => Context
    .make(dbs_info_1.CouchDbsInfoService, dbsInfo)
    .pipe(Context.add(active_tasks_1.CouchActiveTasksService, activeTasks), Context.add(design_docs_1.CouchDesignDocsService, designDocs), Context.add(compact_1.CouchCompactService, compact), Context.add(design_info_1.CouchDesignInfoService, designInfo))));
const streamActiveTasks = () => active_tasks_1.CouchActiveTasksService.pipe(Effect.map(service => service.stream()), Effect.map(effect_1.Stream.takeUntilEffect((0, core_1.untilEmptyCount)(5))));
const streamAll = () => streamActiveTasks()
    .pipe(Effect.map((0, active_tasks_1.filterStreamByType)(TYPE_DB_COMPACT, TYPE_VIEW_COMPACT)));
const streamDb = (dbName) => streamActiveTasks()
    .pipe(Effect.map((0, active_tasks_1.filterStreamByType)(TYPE_DB_COMPACT)), Effect.map(effect_1.Stream.map(effect_1.Array.filter(task => (0, active_tasks_1.getDbName)(task) === dbName))));
const streamDesign = (dbName, designName) => streamActiveTasks()
    .pipe(Effect.map((0, active_tasks_1.filterStreamByType)(TYPE_VIEW_COMPACT)), Effect.map(effect_1.Stream.map(effect_1.Array.filter(task => (0, active_tasks_1.getDbName)(task) === dbName))), Effect.map(effect_1.Stream.map(effect_1.Array.filter(task => (0, active_tasks_1.getDesignName)(task)
    .pipe(effect_1.Option.map(name => name === designName), effect_1.Option.getOrElse(() => false))))));
class CompactService extends Effect.Service()('chtoolbox/CompactService', {
    effect: ServiceContext.pipe(Effect.map(context => ({
        compactAll: () => compactAll.pipe(Effect.andThen(streamAll()), Effect.provide(context)),
        compactDb: (dbName) => compactDb(dbName)
            .pipe(Effect.andThen(streamDb(dbName)), Effect.provide(context)),
        compactDesign: (dbName) => (designName) => compactDesign(dbName)(designName)
            .pipe(Effect.andThen(streamDesign(dbName, designName)), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.CompactService = CompactService;
//# sourceMappingURL=compact.js.map