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
exports.CompactServiceLive = exports.CompactService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const effect_1 = require("effect");
const dbs_info_1 = require("./couch/dbs-info");
const design_docs_1 = require("./couch/design-docs");
const compact_1 = require("./couch/compact");
const design_info_1 = require("./couch/design-info");
exports.CompactService = Context.GenericTag('chtoolbox/CompactService');
const dbNames = dbs_info_1.CouchDbsInfoService.pipe(Effect.flatMap(infoService => infoService.getDbNames()));
const dbsInfo = dbs_info_1.CouchDbsInfoService.pipe(Effect.flatMap(infoService => infoService.get()));
const getDesignDocNames = (dbName) => design_docs_1.CouchDesignDocsService.pipe(Effect.flatMap(designDocsService => designDocsService.getNames(dbName)));
const getDesignInfo = (dbName) => (designId) => design_info_1.CouchDesignInfoService.pipe(Effect.flatMap(designInfoService => designInfoService.get(dbName, designId)));
const compactDb = (dbName) => compact_1.CouchCompactService.pipe(Effect.flatMap(compactService => compactService.compactDb(dbName)));
const compactDesign = (dbName) => (designName) => compact_1.CouchCompactService.pipe(Effect.flatMap(compactService => compactService.compactDesign(dbName, designName)));
const compactAll = dbNames.pipe(Effect.tap(names => (0, effect_1.pipe)(names, effect_1.Array.map(compactDb), Effect.all)), Effect.map(effect_1.Array.map(dbName => getDesignDocNames(dbName)
    .pipe(Effect.map(effect_1.Array.map(compactDesign(dbName))), Effect.flatMap(Effect.all)))), Effect.flatMap(Effect.all), Effect.andThen(Effect.void));
const getCurrentlyCompactingDesignNames = (dbName) => getDesignDocNames(dbName)
    .pipe(Effect.map(effect_1.Array.map(getDesignInfo(dbName))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.filter(designInfo => designInfo.view_index.compact_running)), Effect.map(effect_1.Array.map(designInfo => `${dbName}/${designInfo.name}`)));
const currentlyCompacting = dbsInfo.pipe(Effect.map(effect_1.Array.map(dbInfo => getCurrentlyCompactingDesignNames(dbInfo.key)
    .pipe(Effect.map(viewNames => [
    ...viewNames,
    ...(dbInfo.info.compact_running ? [dbInfo.key] : []),
])))), Effect.flatMap(Effect.all), Effect.map(effect_1.Array.flatten));
exports.CompactServiceLive = Layer.succeed(exports.CompactService, exports.CompactService.of({
    compactAll,
    currentlyCompacting,
}));
//# sourceMappingURL=compact.js.map