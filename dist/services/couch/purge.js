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
exports.purgeFrom = void 0;
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const effect_1 = require("effect");
const cht_client_1 = require("../cht-client");
const PurgeBody = effect_1.Schema.Record({ key: effect_1.Schema.String, value: effect_1.Schema.Array(effect_1.Schema.String) });
const getPostRequest = (dbName, body) => PurgeBody.pipe(platform_1.HttpClientRequest.schemaBodyJson, build => build(platform_1.HttpClientRequest.post(`/${dbName}/_purge`), body), Effect.mapError(x => x));
const purgeDb = (dbName) => (body) => getPostRequest(dbName, body)
    .pipe(Effect.flatMap(cht_client_1.ChtClientService.request), Effect.scoped);
const purgeDocs = (dbName, docs) => (0, effect_1.pipe)(docs, effect_1.Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })), purgeDb(dbName));
const purgeFrom = (dbName) => (docs) => purgeDocs(dbName, docs);
exports.purgeFrom = purgeFrom;
//# sourceMappingURL=purge.js.map