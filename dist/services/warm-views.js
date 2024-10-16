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
exports.WarmViewsService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
const dbs_info_1 = require("./couch/dbs-info");
const design_docs_1 = require("./couch/design-docs");
const design_1 = require("./couch/design");
const view_1 = require("./couch/view");
const design_info_1 = require("./couch/design-info");
const warmView = (dbName, designId) => (viewName) => view_1.CouchViewService.warm(dbName, designId, viewName);
const warmAll = dbs_info_1.CouchDbsInfoService
    .getDbNames()
    .pipe(Effect.map(effect_1.Array.map(dbName => design_docs_1.CouchDesignDocsService
    .getNames(dbName)
    .pipe(Effect.map(effect_1.Array.map(designName => design_1.CouchDesignService
    .getViewNames(dbName, designName)
    .pipe(Effect.map(effect_1.Array.map(warmView(dbName, designName))), Effect.flatMap(Effect.all)))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten)))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
const designsCurrentlyUpdating = dbs_info_1.CouchDbsInfoService
    .getDbNames()
    .pipe(Effect.map(effect_1.Array.map(dbName => design_docs_1.CouchDesignDocsService
    .getNames(dbName)
    .pipe(Effect.map(effect_1.Array.map(designId => design_info_1.CouchDesignInfoService.get(dbName, designId))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.filter(designInfo => designInfo.view_index.updater_running)), Effect.map(effect_1.Array.map(designInfo => ({ dbName, designId: designInfo.name })))))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
const serviceContext = Effect
    .all([
    dbs_info_1.CouchDbsInfoService,
    design_docs_1.CouchDesignDocsService,
    design_1.CouchDesignService,
    view_1.CouchViewService,
    design_info_1.CouchDesignInfoService,
])
    .pipe(Effect.map(([couchDbsInfo, couchDesignDocs, couchDesign, couchView, couchDesignInfo]) => Context
    .make(dbs_info_1.CouchDbsInfoService, couchDbsInfo)
    .pipe(Context.add(design_docs_1.CouchDesignDocsService, couchDesignDocs), Context.add(design_1.CouchDesignService, couchDesign), Context.add(view_1.CouchViewService, couchView), Context.add(design_info_1.CouchDesignInfoService, couchDesignInfo))));
class WarmViewsService extends Effect.Service()('chtoolbox/WarmViewsService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        warmAll: () => warmAll.pipe(Effect.provide(context)),
        designsCurrentlyUpdating: () => designsCurrentlyUpdating.pipe(Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.WarmViewsService = WarmViewsService;
//# sourceMappingURL=warm-views.js.map