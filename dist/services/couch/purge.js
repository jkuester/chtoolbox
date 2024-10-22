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
exports.purgeFrom = exports.CouchPurgeService = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
const cht_client_1 = require("../cht-client");
const PurgeBody = Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) });
const getPostRequest = (dbName, body) => PurgeBody.pipe(platform_1.HttpClientRequest.schemaBodyJson, build => build(platform_1.HttpClientRequest.post(`/${dbName}/_purge`), body), Effect.mapError(x => x));
const purge = (dbName) => (body) => getPostRequest(dbName, body)
    .pipe(Effect.flatMap(cht_client_1.ChtClientService.request), Effect.scoped);
const serviceContext = cht_client_1.ChtClientService.pipe(Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class CouchPurgeService extends Effect.Service()('chtoolbox/CouchPurgeService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        purge: (dbName, docs) => (0, effect_1.pipe)(docs, effect_1.Array.reduce({}, (acc, doc) => ({ ...acc, [doc._id]: [doc._rev] })), purge(dbName), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.CouchPurgeService = CouchPurgeService;
const purgeFrom = (dbName) => (docs) => CouchPurgeService.purge(dbName, docs);
exports.purgeFrom = purgeFrom;
//# sourceMappingURL=purge.js.map