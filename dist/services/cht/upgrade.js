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
exports.completeChtUpgrade = exports.stageChtUpgrade = exports.upgradeCht = void 0;
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const cht_client_1 = require("../cht-client");
const HttpClientError_1 = require("@effect/platform/HttpClientError");
const effect_1 = require("effect");
const ENDPOINT_UPGRADE = '/api/v1/upgrade';
const ENDPOINT_STAGE = `${ENDPOINT_UPGRADE}/stage`;
const ENDPOINT_COMPLETE = `${ENDPOINT_UPGRADE}/complete`;
const UpgradeBody = effect_1.Schema.Struct({
    build: effect_1.Schema.Struct({
        namespace: effect_1.Schema.Literal('medic'),
        application: effect_1.Schema.Literal('medic'),
        version: effect_1.Schema.String,
    })
});
const getPostRequest = (endpoint, version) => UpgradeBody.pipe(platform_1.HttpClientRequest.schemaBodyJson, build => build(platform_1.HttpClientRequest.post(endpoint), { build: { version, namespace: 'medic', application: 'medic' } }), Effect.mapError(x => x));
const postUpgrade = (endpoint, version) => getPostRequest(endpoint, version)
    .pipe(Effect.flatMap(cht_client_1.ChtClientService.request), Effect.scoped);
const upgradeCht = (version) => postUpgrade(ENDPOINT_UPGRADE, version);
exports.upgradeCht = upgradeCht;
const stageChtUpgrade = (version) => postUpgrade(ENDPOINT_STAGE, version);
exports.stageChtUpgrade = stageChtUpgrade;
const completeChtUpgrade = (version) => postUpgrade(ENDPOINT_COMPLETE, version)
    .pipe(Effect.catchIf((err) => err instanceof HttpClientError_1.ResponseError && err.response.status === 502, () => Effect.void), Effect.scoped);
exports.completeChtUpgrade = completeChtUpgrade;
//# sourceMappingURL=upgrade.js.map