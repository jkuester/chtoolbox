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
exports.ReplicateServiceLive = exports.ReplicationDoc = exports.ReplicateService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const pouchdb_1 = require("./pouchdb");
const environment_1 = require("./environment");
const schema_1 = require("@effect/schema");
const effect_1 = require("effect");
exports.ReplicateService = Context.GenericTag('chtoolbox/ReplicateService');
const getPouchDb = (dbName) => Effect.flatMap(pouchdb_1.PouchDBService, pouch => pouch.get(dbName));
const environment = Effect.flatMap(environment_1.EnvironmentService, envSvc => envSvc.get());
const createReplicationDoc = (source, target) => environment.pipe(Effect.map(env => ({
    user_ctx: {
        name: env.user,
        roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: `${effect_1.Redacted.value(env.url)}${source}` },
    target: { url: `${effect_1.Redacted.value(env.url)}${target}` },
    create_target: false,
    continuous: false,
    owner: env.user,
})));
const ServiceContext = Effect
    .all([
    environment_1.EnvironmentService,
    pouchdb_1.PouchDBService,
])
    .pipe(Effect.map(([env, pouch,]) => Context
    .make(pouchdb_1.PouchDBService, pouch)
    .pipe(Context.add(environment_1.EnvironmentService, env))));
class ReplicationDoc extends schema_1.Schema.Class('ReplicationDoc')({
    _replication_state: schema_1.Schema.String,
    _replication_stats: schema_1.Schema.Struct({
        docs_written: schema_1.Schema.Number,
    }),
}) {
}
exports.ReplicationDoc = ReplicationDoc;
exports.ReplicateServiceLive = Layer.effect(exports.ReplicateService, ServiceContext.pipe(Effect.map(context => exports.ReplicateService.of({
    replicate: (source, target) => Effect
        .all([getPouchDb('_replicator'), createReplicationDoc(source, target)])
        .pipe(Effect.flatMap(([db, doc]) => Effect.promise(() => db.bulkDocs([doc]))), Effect.map(([resp]) => resp), Effect.map(pouchdb_1.assertPouchResponse), Effect.provide(context)),
    watch: (repDocId) => getPouchDb('_replicator')
        .pipe(Effect.map(db => db.changes({
        since: 'now',
        live: true,
        include_docs: true,
        doc_ids: [repDocId],
    })), Effect.provide(context)),
}))));
//# sourceMappingURL=replicate.js.map