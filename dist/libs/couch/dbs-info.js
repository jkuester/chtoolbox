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
exports.getDbNames = exports.getDbsInfoByName = exports.getAllDbsInfo = exports.CouchDbInfo = void 0;
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const effect_1 = require("effect");
const cht_client_1 = require("../../services/cht-client");
const ENDPOINT = '/_dbs_info';
const DbsInfoBody = effect_1.Schema.Struct({ keys: effect_1.Schema.Array(effect_1.Schema.String) });
const getPostRequest = (keys) => DbsInfoBody.pipe(platform_1.HttpClientRequest.schemaBodyJson, build => build(platform_1.HttpClientRequest.post(ENDPOINT), { keys }), Effect.mapError(x => x));
class CouchDbInfo extends effect_1.Schema.Class('CouchDbInfo')({
    key: effect_1.Schema.String,
    info: effect_1.Schema.Struct({
        db_name: effect_1.Schema.String,
        update_seq: effect_1.Schema.String,
        sizes: effect_1.Schema.Struct({
            file: effect_1.Schema.Number,
            external: effect_1.Schema.Number,
            active: effect_1.Schema.Number,
        }),
        purge_seq: effect_1.Schema.String,
        doc_del_count: effect_1.Schema.Number,
        doc_count: effect_1.Schema.Number,
        disk_format_version: effect_1.Schema.Number,
        compact_running: effect_1.Schema.Boolean,
        cluster: effect_1.Schema.Struct({
            q: effect_1.Schema.Number,
            n: effect_1.Schema.Number,
            w: effect_1.Schema.Number,
            r: effect_1.Schema.Number,
        }),
        instance_start_time: effect_1.Schema.String,
    }),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(effect_1.Schema.Array(CouchDbInfo));
}
exports.CouchDbInfo = CouchDbInfo;
const getAllDbsInfo = () => cht_client_1.ChtClientService.pipe(Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(ENDPOINT))), Effect.flatMap(CouchDbInfo.decodeResponse), Effect.scoped);
exports.getAllDbsInfo = getAllDbsInfo;
const getDbsInfoByName = (dbNames) => getPostRequest(dbNames)
    .pipe(Effect.flatMap(request => cht_client_1.ChtClientService.request(request)), Effect.flatMap(CouchDbInfo.decodeResponse), Effect.scoped);
exports.getDbsInfoByName = getDbsInfoByName;
const getDbNames = () => (0, exports.getAllDbsInfo)()
    .pipe(Effect.map(effect_1.Array.map(({ key }) => key)));
exports.getDbNames = getDbNames;
//# sourceMappingURL=dbs-info.js.map