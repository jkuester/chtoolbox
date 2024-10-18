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
exports.PurgeService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const pouchdb_1 = require("./pouchdb");
const effect_1 = require("effect");
const purge_1 = require("./couch/purge");
const convertAllDocsResponse = (response) => (0, effect_1.pipe)(response.rows, effect_1.Array.map(({ id, value: { rev } }) => ({ _id: id, _rev: rev })));
const filterDdoc = (purgeDdocs) => (doc) => effect_1.Option
    .liftPredicate(doc, () => !purgeDdocs)
    .pipe(effect_1.Option.map(({ _id }) => _id), effect_1.Option.map(effect_1.Predicate.not(effect_1.String.startsWith('_design/'))), effect_1.Option.getOrElse(() => true));
const serviceContext = Effect
    .all([
    purge_1.CouchPurgeService,
    pouchdb_1.PouchDBService,
])
    .pipe(Effect.map(([purge, pouch,]) => Context
    .make(pouchdb_1.PouchDBService, pouch)
    .pipe(Context.add(purge_1.CouchPurgeService, purge))));
class PurgeService extends Effect.Service()('chtoolbox/PurgeService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        purgeAll: (dbName, purgeDdocs = false) => pouchdb_1.PouchDBService
            .get(dbName)
            .pipe(
        // _purge endpoint only accepts batches of 100.
        // skip: 0 just keeps getting the next 100 (after the last was purged)
        Effect.map((0, pouchdb_1.streamAllDocPages)({ limit: 100, skip: 0 })), Effect.map(effect_1.Stream.tap(response => (0, effect_1.pipe)(convertAllDocsResponse(response), effect_1.Array.filter(filterDdoc(purgeDdocs)), effect_1.Option.liftPredicate(effect_1.Array.isNonEmptyArray), effect_1.Option.map((0, purge_1.purgeFrom)(dbName)), effect_1.Option.getOrElse(() => Effect.void)))), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.PurgeService = PurgeService;
//# sourceMappingURL=purge.js.map