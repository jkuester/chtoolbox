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
exports.CouchDbsInfoServiceLive = exports.CouchDbsInfoService = exports.CouchDbInfo = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const effect_1 = require("effect");
const couch_1 = require("./couch");
const ENDPOINT = '/_dbs_info';
const DbsInfoBody = Schema.Struct({ keys: Schema.Array(Schema.String) });
const getPostRequest = (keys) => DbsInfoBody.pipe(platform_1.HttpClientRequest.schemaBody, build => build(platform_1.HttpClientRequest.post(ENDPOINT), { keys }));
class CouchDbInfo extends Schema.Class('CouchDbInfo')({
    key: Schema.String,
    info: Schema.Struct({
        compact_running: Schema.Boolean,
        sizes: Schema.Struct({
            file: Schema.Number,
            active: Schema.Number,
        }),
    }),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchDbInfo));
}
exports.CouchDbInfo = CouchDbInfo;
exports.CouchDbsInfoService = Context.GenericTag('chtoolbox/CouchDbsInfoService');
const dbsInfo = couch_1.CouchService.pipe(Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(ENDPOINT))), CouchDbInfo.decodeResponse);
const ServiceContext = couch_1.CouchService.pipe(Effect.map(couch => Context.make(couch_1.CouchService, couch)));
exports.CouchDbsInfoServiceLive = Layer.effect(exports.CouchDbsInfoService, ServiceContext.pipe(Effect.map(context => exports.CouchDbsInfoService.of({
    post: (dbNames) => Effect
        .all([couch_1.CouchService, getPostRequest(dbNames)])
        .pipe(Effect.flatMap(([couch, request]) => couch.request(request)), CouchDbInfo.decodeResponse, Effect.mapError(x => x), Effect.provide(context)),
    get: () => dbsInfo.pipe(Effect.provide(context)),
    getDbNames: () => dbsInfo.pipe(Effect.map(effect_1.Array.map(x => x.key)), Effect.provide(context))
}))));
//# sourceMappingURL=dbs-info.js.map