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
exports.ReplicateService = exports.ReplicationDoc = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const pouchdb_1 = require("./pouchdb");
const environment_1 = require("./environment");
const effect_1 = require("effect");
const SKIP_DDOC_SELECTOR = {
    _id: { '$regex': '^(?!_design/)' },
};
const createReplicationDoc = (source, target, includeDdocs) => environment_1.EnvironmentService
    .get()
    .pipe(Effect.map(env => ({
    user_ctx: {
        name: env.user,
        roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: `${effect_1.Redacted.value(env.url)}${source}` },
    target: { url: `${effect_1.Redacted.value(env.url)}${target}` },
    create_target: false,
    continuous: false,
    owner: env.user,
    selector: includeDdocs ? undefined : SKIP_DDOC_SELECTOR,
})));
class ReplicationDoc extends effect_1.Schema.Class('ReplicationDoc')({
    _id: effect_1.Schema.String,
    _replication_state: effect_1.Schema.optional(effect_1.Schema.String),
    _replication_stats: effect_1.Schema.optional(effect_1.Schema.Struct({
        docs_written: effect_1.Schema.Number,
    })),
}) {
}
exports.ReplicationDoc = ReplicationDoc;
const streamReplicationDocChanges = (repDocId) => pouchdb_1.PouchDBService
    .get('_replicator')
    .pipe(Effect.map((0, pouchdb_1.streamChanges)({
    include_docs: true,
    doc_ids: [repDocId],
})), Effect.map(effect_1.Stream.map(({ doc }) => doc)), Effect.map(effect_1.Stream.mapEffect(effect_1.Schema.decodeUnknown(ReplicationDoc))), Effect.map(effect_1.Stream.takeUntil(({ _replication_state }) => _replication_state === 'completed')));
const serviceContext = Effect
    .all([
    environment_1.EnvironmentService,
    pouchdb_1.PouchDBService,
])
    .pipe(Effect.map(([env, pouch,]) => Context
    .make(pouchdb_1.PouchDBService, pouch)
    .pipe(Context.add(environment_1.EnvironmentService, env))));
class ReplicateService extends Effect.Service()('chtoolbox/ReplicateService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        replicate: (source, target, includeDdocs = false) => Effect
            .all([pouchdb_1.PouchDBService.get('_replicator'), createReplicationDoc(source, target, includeDdocs)])
            .pipe(Effect.flatMap(([db, doc]) => Effect.promise(() => db.bulkDocs([doc]))), Effect.map(([resp]) => resp), Effect.map(pouchdb_1.assertPouchResponse), Effect.map(({ id }) => id), Effect.flatMap(streamReplicationDocChanges), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.ReplicateService = ReplicateService;
//# sourceMappingURL=replicate.js.map