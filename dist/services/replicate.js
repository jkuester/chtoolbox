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
exports.ReplicateServiceLive = exports.ReplicateService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const effect_1 = require("effect");
const pouchdb_1 = require("./pouchdb");
const environment_1 = require("./environment");
exports.ReplicateService = Context.GenericTag('chtoolbox/ReplicateService');
const getPouchDb = (dbName) => Effect.flatMap(pouchdb_1.PouchDBService, pouch => pouch.get(dbName));
const couchUrl = environment_1.EnvironmentService.pipe(Effect.map(service => service.get()), Effect.map(env => env.url), Effect.flatMap(effect_1.Ref.get), Effect.flatMap(effect_1.Config.map(effect_1.Redacted.value)), Effect.map(url => (0, effect_1.pipe)(effect_1.Option.liftPredicate(url, effect_1.String.endsWith('/')), effect_1.Option.getOrElse(() => `${url}/`))));
const COUCH_USER_PATTERN = /^https?:\/\/([^:]+):.+$/;
const getCouchUser = (url) => (0, effect_1.pipe)(COUCH_USER_PATTERN.exec(url)?.[1], effect_1.Option.fromNullable, effect_1.Option.getOrThrow);
const createReplicationDoc = (source, target) => couchUrl.pipe(Effect.map(url => (0, effect_1.pipe)(getCouchUser(url), owner => ({
    user_ctx: {
        name: owner,
        roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: `${url}${source}` },
    target: { url: `${url}${target}` },
    create_target: false,
    continuous: false,
    owner,
}))));
const ServiceContext = Effect
    .all([
    environment_1.EnvironmentService,
    pouchdb_1.PouchDBService,
])
    .pipe(Effect.map(([env, pouch,]) => Context
    .make(pouchdb_1.PouchDBService, pouch)
    .pipe(Context.add(environment_1.EnvironmentService, env))));
exports.ReplicateServiceLive = Layer.effect(exports.ReplicateService, ServiceContext.pipe(Effect.map(context => exports.ReplicateService.of({
    replicateAsync: (source, target) => Effect
        .all([getPouchDb('_replicator'), createReplicationDoc(source, target)])
        .pipe(Effect.flatMap(([db, doc]) => Effect.promise(() => db.bulkDocs([doc]))), Effect.mapError(x => x), Effect.provide(context)),
    replicate: (source, target) => Effect
        .all(effect_1.Array.map([source, target], getPouchDb))
        .pipe(Effect.flatMap(([sourceDb, targetDb]) => Effect.promise(() => sourceDb.replicate.to(targetDb))), Effect.provide(context)),
}))));
//# sourceMappingURL=replicate.js.map