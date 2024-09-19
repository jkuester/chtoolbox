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
exports.WarmViewsServiceLive = exports.WarmViewsService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const effect_1 = require("effect");
const dbs_info_1 = require("./couch/dbs-info");
const design_docs_1 = require("./couch/design-docs");
const design_1 = require("./couch/design");
const view_1 = require("./couch/view");
const design_info_1 = require("./couch/design-info");
exports.WarmViewsService = Context.GenericTag('chtoolbox/WarmViewsService');
const dbNames = dbs_info_1.CouchDbsInfoService.pipe(Effect.flatMap(infoService => infoService.getDbNames()));
const getDesignDocIds = (dbName) => design_docs_1.CouchDesignDocsService.pipe(Effect.flatMap(designDocsService => designDocsService.getNames(dbName)));
const getViewNames = (dbName, designId) => design_1.CouchDesignService.pipe(Effect.flatMap(designService => designService.getViewNames(dbName, designId)));
const warmView = (dbName, designId) => (viewName) => view_1.CouchViewService.pipe(Effect.flatMap(viewService => viewService.warm(dbName, designId, viewName)));
const getDesignInfo = (dbName, designId) => design_info_1.CouchDesignInfoService.pipe(Effect.flatMap(designInfoService => designInfoService.get(dbName, designId)));
const warmAll = dbNames.pipe(Effect.map(effect_1.Array.map(dbName => getDesignDocIds(dbName)
    .pipe(Effect.map(effect_1.Array.map(designId => getViewNames(dbName, designId)
    .pipe(Effect.map(effect_1.Array.map(warmView(dbName, designId))), Effect.flatMap(Effect.all)))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten)))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
const designsCurrentlyUpdating = dbNames.pipe(Effect.map(effect_1.Array.map(dbName => getDesignDocIds(dbName)
    .pipe(Effect.map(effect_1.Array.map(designId => getDesignInfo(dbName, designId))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.filter(designInfo => designInfo.view_index.updater_running)), Effect.map(effect_1.Array.map(designInfo => ({ dbName, designId: designInfo.name })))))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
exports.WarmViewsServiceLive = Layer.succeed(exports.WarmViewsService, exports.WarmViewsService.of({
    warmAll,
    designsCurrentlyUpdating,
}));
// (async () => {
//   await Effect.runPromise(WarmViewsService.pipe(
//     Effect.flatMap(s => s.warmAll),
//     Effect.provide(NodeContext.layer),
//     Effect.provide(NodeHttpClient.layer),
//     Effect.provide(EnvironmentServiceLive),
//     Effect.provide(CouchServiceLive),
//     Effect.provide(CouchNodeSystemServiceLive),
//     Effect.provide(CouchDbsInfoServiceLive),
//     Effect.provide(CouchDesignDocsServiceLive),
//     Effect.provide(CouchDesignInfoServiceLive),
//     Effect.provide(CouchDesignServiceLive),
//     Effect.provide(CouchViewServiceLive),
//     Effect.provide(LocalDiskUsageServiceLive),
//     Effect.provide(MonitorServiceLive),
//     Effect.provide(WarmViewsServiceLive),
//   ));
//
//   await Effect.runPromise(anyDesignUpdating.pipe(
//     Effect.provide(NodeContext.layer),
//     Effect.provide(NodeHttpClient.layer),
//     Effect.provide(EnvironmentServiceLive),
//     Effect.provide(CouchServiceLive),
//     Effect.provide(CouchNodeSystemServiceLive),
//     Effect.provide(CouchDbsInfoServiceLive),
//     Effect.provide(CouchDesignDocsServiceLive),
//     Effect.provide(CouchDesignInfoServiceLive),
//     Effect.provide(CouchDesignServiceLive),
//     Effect.provide(CouchViewServiceLive),
//     Effect.provide(LocalDiskUsageServiceLive),
//     Effect.provide(MonitorServiceLive),
//     Effect.provide(WarmViewsServiceLive),
//   ));
// })();
//# sourceMappingURL=warm-views.js.map