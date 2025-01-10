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
exports.getDesignInfo = exports.CouchDesignInfo = void 0;
const effect_1 = require("effect");
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const cht_client_1 = require("../../services/cht-client");
class CouchDesignInfo extends effect_1.Schema.Class('CouchDesignInfo')({
    name: effect_1.Schema.String,
    view_index: effect_1.Schema.Struct({
        collator_versions: effect_1.Schema.Array(effect_1.Schema.String),
        compact_running: effect_1.Schema.Boolean,
        language: effect_1.Schema.String,
        purge_seq: effect_1.Schema.Number,
        signature: effect_1.Schema.String,
        sizes: effect_1.Schema.Struct({
            active: effect_1.Schema.Number,
            external: effect_1.Schema.Number,
            file: effect_1.Schema.Number,
        }),
        updater_running: effect_1.Schema.Boolean,
        updates_pending: effect_1.Schema.Struct({
            minimum: effect_1.Schema.Number,
            preferred: effect_1.Schema.Number,
            total: effect_1.Schema.Number,
        }),
        waiting_commit: effect_1.Schema.Boolean,
        waiting_clients: effect_1.Schema.Number,
    }),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(CouchDesignInfo);
}
exports.CouchDesignInfo = CouchDesignInfo;
const getDesignInfo = (dbName, designName) => cht_client_1.ChtClientService
    .request(platform_1.HttpClientRequest.get(`/${dbName}/_design/${designName}/_info`))
    .pipe(Effect.flatMap(CouchDesignInfo.decodeResponse), Effect.scoped);
exports.getDesignInfo = getDesignInfo;
//# sourceMappingURL=design-info.js.map