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
const couchUrl = environment_1.EnvironmentService.pipe(Effect.flatMap(service => service.get()), Effect.map(({ url }) => url));
const clientWithUrl = couchUrl.pipe(Effect.flatMap(url => platform_1.HttpClient.HttpClient.pipe(Effect.map(platform_1.HttpClient.filterStatusOk), Effect.map(platform_1.HttpClient.mapRequest(platform_1.HttpClientRequest.prependUrl(effect_1.Redacted.value(url)))))));
const ServiceContext = Effect
    .all([
    environment_1.EnvironmentService,
    platform_1.HttpClient.HttpClient,
])
    .pipe(Effect.map(([env, client]) => Context
    .make(environment_1.EnvironmentService, env)
    .pipe(Context.add(platform_1.HttpClient.HttpClient, client))));
exports.CouchServiceLive = effect_1.Layer.effect(exports.CouchService, ServiceContext.pipe(Effect.map(context => exports.CouchService.of({
    request: (request) => (0, effect_1.pipe)(clientWithUrl, Effect.flatMap(client => client.execute(request)), Effect.mapError(x => x), Effect.provide(context))
}))));
//# sourceMappingURL=couch.js.map