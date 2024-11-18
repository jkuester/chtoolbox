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
exports.NouveauInfoService = exports.NouveauInfo = void 0;
const effect_1 = require("effect");
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const cht_client_1 = require("../cht-client");
class NouveauInfo extends effect_1.Schema.Class('NouveauInfo')({
    name: effect_1.Schema.String,
    search_index: effect_1.Schema.Struct({
        update_seq: effect_1.Schema.Number,
        purge_seq: effect_1.Schema.Number,
        num_docs: effect_1.Schema.Number,
        disk_size: effect_1.Schema.Number,
    }),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(NouveauInfo);
}
exports.NouveauInfo = NouveauInfo;
const serviceContext = cht_client_1.ChtClientService.pipe(Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class NouveauInfoService extends Effect.Service()('chtoolbox/NouveauInfoService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        get: (dbName, ddocName, indexName) => cht_client_1.ChtClientService
            .request(platform_1.HttpClientRequest.get(`/${dbName}/_design/${ddocName}/_nouveau_info/${indexName}`))
            .pipe(Effect.flatMap(NouveauInfo.decodeResponse), Effect.scoped, Effect.provide(context))
    }))),
    accessors: true,
}) {
}
exports.NouveauInfoService = NouveauInfoService;
//# sourceMappingURL=nouveau-info.js.map