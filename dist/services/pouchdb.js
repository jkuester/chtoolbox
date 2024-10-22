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
exports.PouchDBService = exports.streamQueryPages = exports.streamAllDocPages = exports.assertPouchResponse = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
const pouchdb_core_1 = __importDefault(require("pouchdb-core"));
const core_1 = require("../libs/core");
const pouchdb_adapter_http_1 = __importDefault(require("pouchdb-adapter-http"));
const pouchdb_mapreduce_1 = __importDefault(require("pouchdb-mapreduce"));
// @ts-expect-error no types for this package
const pouchdb_session_authentication_1 = __importDefault(require("pouchdb-session-authentication"));
const environment_1 = require("./environment");
pouchdb_core_1.default.plugin(pouchdb_adapter_http_1.default);
pouchdb_core_1.default.plugin(pouchdb_session_authentication_1.default);
pouchdb_core_1.default.plugin(pouchdb_mapreduce_1.default);
const isPouchResponse = (value) => 'ok' in value && value.ok;
const assertPouchResponse = (value) => (0, effect_1.pipe)(effect_1.Option.liftPredicate(value, isPouchResponse), effect_1.Option.getOrThrowWith(() => value));
exports.assertPouchResponse = assertPouchResponse;
const allDocs = (db, options) => Effect
    .promise(() => db.allDocs(options));
const getAllDocsPage = (db, options) => (skip) => allDocs(db, { skip, ...options })
    .pipe(Effect.map((response) => [
    response,
    effect_1.Option.liftPredicate(skip + options.limit, () => response.rows.length === options.limit),
]));
const streamAllDocPages = (options = {}) => (db) => (0, effect_1.pipe)(getAllDocsPage(db, { ...options, limit: options.limit ?? 1000 }), pageFn => effect_1.Stream.paginateEffect(0, pageFn));
exports.streamAllDocPages = streamAllDocPages;
const query = (db, viewIndex, options) => Effect
    .promise(() => db.query(viewIndex, options));
const getQueryPage = (db, viewIndex, options) => (skip) => query(db, viewIndex, { skip, ...options })
    .pipe(Effect.map((response) => [
    response,
    effect_1.Option.liftPredicate(skip + options.limit, () => response.rows.length === options.limit),
]));
const streamQueryPages = (viewIndex, options = {}) => (db) => (0, effect_1.pipe)(getQueryPage(db, viewIndex, { ...options, limit: options.limit ?? 1000 }), pageFn => effect_1.Stream.paginateEffect(0, pageFn));
exports.streamQueryPages = streamQueryPages;
const couchUrl = environment_1.EnvironmentService
    .get()
    .pipe(Effect.map(({ url }) => url));
const getPouchDB = (dbName) => couchUrl.pipe(Effect.map(url => (0, core_1.pouchDB)(`${effect_1.Redacted.value(url)}${dbName}`)));
const serviceContext = environment_1.EnvironmentService.pipe(Effect.map(env => Context.make(environment_1.EnvironmentService, env)));
class PouchDBService extends Effect.Service()('chtoolbox/PouchDBService', {
    effect: Effect
        .all([
        serviceContext,
        Effect.cachedFunction(getPouchDB),
    ])
        .pipe(Effect.map(([context, memoizedGetPouchDb]) => ({
        get: (dbName) => memoizedGetPouchDb(dbName)
            .pipe(Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.PouchDBService = PouchDBService;
//# sourceMappingURL=pouchdb.js.map