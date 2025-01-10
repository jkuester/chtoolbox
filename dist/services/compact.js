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
const dbs_info_1 = require("../libs/couch/dbs-info");
const design_docs_1 = require("../libs/couch/design-docs");
const compact_1 = require("../libs/couch/compact");
const design_info_1 = require("./couch/design-info");
const active_tasks_1 = require("./couch/active-tasks");
const core_1 = require("../libs/core");
const cht_client_1 = require("./cht-client");
const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';
const compactDbViews = (dbName) => (0, design_docs_1.getDesignDocNames)(dbName)
    .pipe(Effect.map(effect_1.Array.map(compactCouchDesign(dbName))), Effect.flatMap(Effect.all));
const compactCouchDb = (dbName, compactDesigns) => (0, compact_1.compactDb)(dbName)
    .pipe(Effect.andThen(effect_1.Match
    .value(compactDesigns)
    .pipe(effect_1.Match.when(true, () => compactDbViews(dbName)), effect_1.Match.orElse(() => Effect.void))));
const compactCouchDesign = (dbName) => (designName) => (0, compact_1.compactDesign)(dbName, designName);
const compactAll = (compactDesigns) => (0, dbs_info_1.getDbNames)()
    .pipe(Effect.map(effect_1.Array.map(dbName => compactCouchDb(dbName, compactDesigns))), Effect.flatMap(Effect.all));
const streamActiveTasks = () => active_tasks_1.CouchActiveTasksService.pipe(Effect.map(service => service.stream()), Effect.map(effect_1.Stream.takeUntilEffect((0, core_1.untilEmptyCount)(5))));
const getActiveTaskTypeFilter = (compactDesigns) => (0, effect_1.pipe)([TYPE_DB_COMPACT, TYPE_VIEW_COMPACT], effect_1.Option.liftPredicate(() => compactDesigns), effect_1.Option.getOrElse(() => [TYPE_DB_COMPACT]), types => (0, active_tasks_1.filterStreamByType)(...types));
const streamAll = (compactDesigns) => streamActiveTasks()
    .pipe(Effect.map(getActiveTaskTypeFilter(compactDesigns)));
const streamDb = (dbName, compactDesigns) => streamAll(compactDesigns)
    .pipe(Effect.map(effect_1.Stream.map(effect_1.Array.filter(task => (0, active_tasks_1.getDbName)(task) === dbName))));
const streamDesign = (dbName, designName) => streamActiveTasks()
    .pipe(Effect.map((0, active_tasks_1.filterStreamByType)(TYPE_VIEW_COMPACT)), Effect.map(effect_1.Stream.map(effect_1.Array.filter(task => (0, active_tasks_1.getDbName)(task) === dbName))), Effect.map(effect_1.Stream.map(effect_1.Array.filter(task => (0, active_tasks_1.getDesignName)(task)
    .pipe(effect_1.Option.map(name => name === designName), effect_1.Option.getOrElse(() => false))))));
const serviceContext = Effect
    .all([
    active_tasks_1.CouchActiveTasksService,
    design_info_1.CouchDesignInfoService,
    cht_client_1.ChtClientService,
])
    .pipe(Effect.map(([activeTasks, designInfo, chtClient,]) => Context
    .make(active_tasks_1.CouchActiveTasksService, activeTasks)
    .pipe(Context.add(design_info_1.CouchDesignInfoService, designInfo), Context.add(cht_client_1.ChtClientService, chtClient))));
class CompactService extends Effect.Service()('chtoolbox/CompactService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        compactAll: (compactDesigns) => compactAll(compactDesigns)
            .pipe(Effect.andThen(streamAll(compactDesigns)), Effect.provide(context)),
        compactDb: (dbName, compactDesigns) => compactCouchDb(dbName, compactDesigns)
            .pipe(Effect.andThen(streamDb(dbName, compactDesigns)), Effect.provide(context)),
        compactDesign: (dbName) => (designName) => compactCouchDesign(dbName)(designName)
            .pipe(Effect.andThen(streamDesign(dbName, designName)), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.CompactService = CompactService;
//# sourceMappingURL=compact.js.map