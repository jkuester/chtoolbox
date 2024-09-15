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
exports.CouchServiceLive = exports.CouchService = void 0;
const environment_1 = require("../environment");
const Effect = __importStar(require("effect/Effect"));
const platform_1 = require("@effect/platform");
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
exports.CouchService = Context.GenericTag('chtoolbox/CouchService');
const getEnvironment = environment_1.EnvironmentService.pipe(Effect.map(envService => envService.get()));
const getCouchRequest = getEnvironment.pipe(Effect.map(({ couchUrl }) => platform_1.HttpClientRequest.prependUrl(couchUrl)), Effect.map(req => platform_1.HttpClient.mapRequest(req)));
const getHttpClient = platform_1.HttpClient.HttpClient.pipe(Effect.map(platform_1.HttpClient.filterStatusOk));
const getCouchClient = Effect
    .all([
    getHttpClient,
    getCouchRequest
])
    .pipe(Effect.map(([client, request]) => request(client)));
const createCouchService = getCouchClient.pipe(Effect.map(client => exports.CouchService.of({
    request: (request) => client(request)
})));
exports.CouchServiceLive = effect_1.Layer
    .effect(exports.CouchService, createCouchService);
//# sourceMappingURL=couch.js.map