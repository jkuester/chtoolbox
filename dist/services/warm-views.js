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
const dbs_info_1 = require("../libs/couch/dbs-info");
const design_docs_1 = require("../libs/couch/design-docs");
const design_1 = require("../libs/couch/design");
const view_1 = require("../libs/couch/view");
const design_info_1 = require("../libs/couch/design-info");
const cht_client_1 = require("./cht-client");
const warmCouchView = (dbName, designId) => (viewName) => (0, view_1.warmView)(dbName, designId, viewName);
const warmAll = () => (0, dbs_info_1.getDbNames)()
    .pipe(Effect.map(effect_1.Array.map(dbName => (0, design_docs_1.getDesignDocNames)(dbName)
    .pipe(Effect.map(effect_1.Array.map(designName => (0, design_1.getViewNames)(dbName, designName)
    .pipe(Effect.map(effect_1.Array.map(warmCouchView(dbName, designName))), Effect.flatMap(Effect.all)))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten)))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
const designsCurrentlyUpdating = () => (0, dbs_info_1.getDbNames)()
    .pipe(Effect.map(effect_1.Array.map(dbName => (0, design_docs_1.getDesignDocNames)(dbName)
    .pipe(Effect.map(effect_1.Array.map(designId => (0, design_info_1.getDesignInfo)(dbName, designId))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.filter(designInfo => designInfo.view_index.updater_running)), Effect.map(effect_1.Array.map(designInfo => ({ dbName, designId: designInfo.name })))))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
const serviceContext = cht_client_1.ChtClientService.pipe(Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class WarmViewsService extends Effect.Service()('chtoolbox/WarmViewsService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        warmAll: () => warmAll()
            .pipe(Effect.provide(context)),
        designsCurrentlyUpdating: () => designsCurrentlyUpdating()
            .pipe(Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.WarmViewsService = WarmViewsService;
//# sourceMappingURL=warm-views.js.map