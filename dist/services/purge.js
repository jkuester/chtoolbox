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
const cht_client_1 = require("./cht-client");
// _purge endpoint only accepts batches of 100.
// skip: 0 just keeps getting the next 100 (after the last was purged)
const PAGE_OPTIONS = { limit: 100, skip: 0 };
const AllDocsRow = effect_1.Schema.Struct({ id: effect_1.Schema.String, value: effect_1.Schema.Struct({ rev: effect_1.Schema.String }) });
const convertAllDocsResponse = (response) => (0, effect_1.pipe)(response.rows, effect_1.Array.filter(effect_1.Schema.is(AllDocsRow)), x => x, effect_1.Array.map(({ id, value: { rev } }) => ({ _id: id, _rev: rev })));
const filterDdoc = (purgeDdocs) => (doc) => effect_1.Option
    .liftPredicate(doc, () => !purgeDdocs)
    .pipe(effect_1.Option.map(({ _id }) => _id), effect_1.Option.map(effect_1.Predicate.not(effect_1.String.startsWith('_design/'))), effect_1.Option.getOrElse(() => true));
const purgeRows = (dbName) => (rows) => effect_1.Option
    .liftPredicate(rows, effect_1.Array.isNonEmptyArray)
    .pipe(effect_1.Option.map((0, purge_1.purgeFrom)(dbName)), effect_1.Option.map(Effect.andThen(Effect.void)), effect_1.Option.getOrElse(() => Effect.void));
const getReportQueryOptions = ({ since, before }) => ({
    ...PAGE_OPTIONS,
    startkey: since.pipe(effect_1.Option.map(date => [date.getTime()]), effect_1.Option.getOrUndefined),
    endkey: before.pipe(effect_1.Option.map(date => [date.getTime()]), effect_1.Option.getOrUndefined),
});
const getAllDocs = (dbName) => (keys) => pouchdb_1.PouchDBService
    .get(dbName)
    .pipe(Effect.flatMap(db => Effect.promise(() => db.allDocs({ keys }))));
const purgeDocsFromResponse = (dbName) => (response) => (0, effect_1.pipe)(response.rows, effect_1.Array.map(({ id }) => id), getAllDocs(dbName), Effect.map(convertAllDocsResponse), Effect.flatMap(purgeRows(dbName)));
const purgeByViewQuery = (dbName, viewName) => (opts) => pouchdb_1.PouchDBService
    .get(dbName)
    .pipe(Effect.map((0, pouchdb_1.streamQueryPages)(viewName, opts)), Effect.map(effect_1.Stream.tap(purgeDocsFromResponse(dbName))));
const serviceContext = Effect
    .all([
    cht_client_1.ChtClientService,
    pouchdb_1.PouchDBService,
])
    .pipe(Effect.map(([chtClient, pouch,]) => Context
    .make(pouchdb_1.PouchDBService, pouch)
    .pipe(Context.add(cht_client_1.ChtClientService, chtClient))));
class PurgeService extends Effect.Service()('chtoolbox/PurgeService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        purgeAll: (dbName, purgeDdocs = false) => pouchdb_1.PouchDBService
            .get(dbName)
            .pipe(Effect.map((0, pouchdb_1.streamAllDocPages)(PAGE_OPTIONS)), Effect.map(effect_1.Stream.tap(response => (0, effect_1.pipe)(convertAllDocsResponse(response), effect_1.Array.filter(filterDdoc(purgeDdocs)), purgeRows(dbName)))), Effect.map(effect_1.Stream.provideContext(context)), Effect.provide(context)),
        purgeReports: (dbName, opts) => (0, effect_1.pipe)(getReportQueryOptions(opts), purgeByViewQuery(dbName, 'medic-client/reports_by_date'), Effect.map(effect_1.Stream.provideContext(context)), Effect.provide(context)),
        purgeContacts: (dbName, type) => (0, effect_1.pipe)({ ...PAGE_OPTIONS, key: [type] }, purgeByViewQuery(dbName, 'medic-client/contacts_by_type'), Effect.map(effect_1.Stream.provideContext(context)), Effect.provide(context))
    }))),
    accessors: true,
}) {
}
exports.PurgeService = PurgeService;
//# sourceMappingURL=purge.js.map