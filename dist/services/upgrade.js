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
exports.UpgradeService = exports.UpgradeLog = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const pouchdb_1 = require("./pouchdb");
const effect_1 = require("effect");
const upgrade_1 = require("./cht/upgrade");
const cht_client_1 = require("./cht-client");
const UPGRADE_LOG_NAME = 'upgrade_log';
const COMPLETED_STATES = ['finalized', 'aborted', 'errored', 'interrupted'];
const STAGING_COMPLETE_STATES = ['indexed', ...COMPLETED_STATES];
const UPGRADE_LOG_STATES = [
    'initiated',
    'staged',
    'indexing',
    'completing',
    'finalizing',
    'complete',
    'aborting',
    ...STAGING_COMPLETE_STATES,
];
class UpgradeLog extends effect_1.Schema.Class('UpgradeLog')({
    _id: effect_1.Schema.String,
    state: effect_1.Schema.Literal(...UPGRADE_LOG_STATES),
    state_history: effect_1.Schema.Array(effect_1.Schema.Struct({
        state: effect_1.Schema.Literal(...UPGRADE_LOG_STATES),
        date: effect_1.Schema.Number,
    })),
}) {
}
exports.UpgradeLog = UpgradeLog;
const latestUpgradeLog = pouchdb_1.PouchDBService
    .get('medic-logs')
    .pipe(Effect.flatMap(db => Effect.tryPromise(() => db.allDocs({
    startkey: `${UPGRADE_LOG_NAME}:${effect_1.DateTime.unsafeNow()
        .epochMillis
        .toString()}:`,
    endkey: `${UPGRADE_LOG_NAME}:0:`,
    descending: true,
    limit: 1,
    include_docs: true,
}))), Effect.map(({ rows }) => rows), Effect.map(effect_1.Option.liftPredicate(effect_1.Array.isNonEmptyArray)), Effect.map(effect_1.Option.map(([{ doc }]) => doc)), Effect.map(effect_1.Option.flatMap(effect_1.Option.fromNullable)), Effect.map(effect_1.Option.flatMap(effect_1.Schema.decodeUnknownOption(UpgradeLog))));
const streamChangesFeed = (upgradeLogId) => pouchdb_1.PouchDBService
    .get('medic-logs')
    .pipe(Effect.map((0, pouchdb_1.streamChanges)({
    include_docs: true,
    doc_ids: [upgradeLogId]
})));
const streamUpgradeLogChanges = (completedStates) => latestUpgradeLog
    .pipe(Effect.map(effect_1.Option.getOrThrowWith(() => new Error('No upgrade log found'))), Effect.flatMap(({ _id }) => streamChangesFeed(_id)), Effect.map(effect_1.Stream.retry(effect_1.Schedule.spaced(1000))), Effect.map(effect_1.Stream.map(({ doc }) => doc)), Effect.map(effect_1.Stream.map(effect_1.Schema.decodeUnknownSync(UpgradeLog))), Effect.map(effect_1.Stream.takeUntil(({ state }) => completedStates.includes(state))));
const serviceContext = Effect
    .all([
    cht_client_1.ChtClientService,
    pouchdb_1.PouchDBService,
])
    .pipe(Effect.map(([chtClient, pouch,]) => Context
    .make(pouchdb_1.PouchDBService, pouch)
    .pipe(Context.add(cht_client_1.ChtClientService, chtClient))));
const assertReadyForUpgrade = latestUpgradeLog.pipe(Effect.map(effect_1.Option.map(({ state }) => state)), Effect.map(effect_1.Match.value), Effect.map(effect_1.Match.when(effect_1.Option.isNone, () => Effect.void)), Effect.map(effect_1.Match.when(state => COMPLETED_STATES.includes(effect_1.Option.getOrThrow(state)), () => Effect.void)), Effect.flatMap(effect_1.Match.orElse(() => Effect.fail(new Error('Upgrade already in progress.')))));
const assertReadyForComplete = latestUpgradeLog.pipe(Effect.map(effect_1.Option.map(({ state }) => state)), Effect.map(effect_1.Match.value), Effect.map(effect_1.Match.when(state => effect_1.Option.isSome(state) && effect_1.Option.getOrThrow(state) === 'indexed', () => Effect.void)), Effect.flatMap(effect_1.Match.orElse(() => Effect.fail(new Error('No upgrade ready for completion.')))));
class UpgradeService extends Effect.Service()('chtoolbox/UpgradeService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        upgrade: (version) => assertReadyForUpgrade.pipe(Effect.andThen((0, upgrade_1.upgradeCht)(version)), Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)), Effect.provide(context)),
        stage: (version) => assertReadyForUpgrade.pipe(Effect.andThen((0, upgrade_1.stageChtUpgrade)(version)), Effect.andThen(streamUpgradeLogChanges(STAGING_COMPLETE_STATES)), Effect.provide(context)),
        complete: (version) => assertReadyForComplete.pipe(Effect.andThen((0, upgrade_1.completeChtUpgrade)(version)), Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)
            .pipe(Effect.retry(effect_1.Schedule.spaced(1000)))), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.UpgradeService = UpgradeService;
//# sourceMappingURL=upgrade.js.map