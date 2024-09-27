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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PouchDBServiceLive = exports.PouchDBService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
const pouchdb_core_1 = __importDefault(require("pouchdb-core"));
const core_1 = require("../libs/core");
const pouchdb_adapter_http_1 = __importDefault(require("pouchdb-adapter-http"));
// @ts-expect-error no types for this package
const pouchdb_session_authentication_1 = __importDefault(require("pouchdb-session-authentication"));
const pouchdb_replication_1 = __importDefault(require("pouchdb-replication"));
const environment_1 = require("./environment");
pouchdb_core_1.default.plugin(pouchdb_adapter_http_1.default);
pouchdb_core_1.default.plugin(pouchdb_session_authentication_1.default);
pouchdb_core_1.default.plugin(pouchdb_replication_1.default);
exports.PouchDBService = Context.GenericTag('chtoolbox/PouchDBService');
const couchUrl = environment_1.EnvironmentService.pipe(Effect.map(service => service.get()), Effect.map(env => env.url), Effect.flatMap(effect_1.Ref.get), Effect.map(effect_1.Config.map(effect_1.Redacted.value)), Effect.map(effect_1.Config.map(url => (0, effect_1.pipe)(effect_1.Option.liftPredicate(url, effect_1.String.endsWith('/')), effect_1.Option.getOrElse(() => `${url}/`)))), Effect.flatten, Effect.mapError(x => x));
const getPouchDB = (dbName) => couchUrl.pipe(Effect.map(url => (0, core_1.pouchDB)(`${url}${dbName}`)));
const ServiceContext = environment_1.EnvironmentService.pipe(Effect.map(env => Context.make(environment_1.EnvironmentService, env)));
exports.PouchDBServiceLive = effect_1.Layer.effect(exports.PouchDBService, Effect
    .all([
    ServiceContext,
    Effect.cachedFunction(getPouchDB),
])
    .pipe(Effect.map(([context, memoizedGetPouchDb]) => exports.PouchDBService.of({
    get: (dbName) => memoizedGetPouchDb(dbName)
        .pipe(Effect.provide(context)),
}))));
//# sourceMappingURL=pouchdb.js.map