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
exports.CouchCompactService = void 0;
const effect_1 = require("effect");
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const cht_client_1 = require("../cht-client");
const getDesignPath = (designName) => designName ? `/${designName}` : '';
const getCompactRequest = (dbName, designName) => effect_1.Schema
    .Struct({})
    .pipe(platform_1.HttpClientRequest.schemaBodyJson, build => build(platform_1.HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}), Effect.mapError(x => x));
const compact = (context) => (dbName, designName) => getCompactRequest(dbName, designName)
    .pipe(Effect.flatMap(request => cht_client_1.ChtClientService.request(request)), Effect.andThen(Effect.void), Effect.scoped, Effect.provide(context));
const serviceContext = cht_client_1.ChtClientService.pipe(Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class CouchCompactService extends Effect.Service()('chtoolbox/CouchCompactService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        compactDb: compact(context),
        compactDesign: compact(context),
    }))),
    accessors: true,
}) {
}
exports.CouchCompactService = CouchCompactService;
//# sourceMappingURL=compact.js.map