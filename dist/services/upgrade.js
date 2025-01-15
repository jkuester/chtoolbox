import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, streamChanges } from './pouchdb.js';
import { Array, DateTime, Match, Option, Schedule, Schema, Stream } from 'effect';
import { completeChtUpgrade, stageChtUpgrade, upgradeCht } from '../libs/cht/upgrade.js';
import { ChtClientService } from './cht-client.js';
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
export class UpgradeLog extends Schema.Class('UpgradeLog')({
    _id: Schema.String,
    state: Schema.Literal(...UPGRADE_LOG_STATES),
    state_history: Schema.Array(Schema.Struct({
        state: Schema.Literal(...UPGRADE_LOG_STATES),
        date: Schema.Number,
    })),
}) {
}
const latestUpgradeLog = PouchDBService
    .get('medic-logs')
    .pipe(Effect.flatMap(db => Effect.tryPromise(() => db.allDocs({
    startkey: `${UPGRADE_LOG_NAME}:${DateTime.unsafeNow()
        .epochMillis
        .toString()}:`,
    endkey: `${UPGRADE_LOG_NAME}:0:`,
    descending: true,
    limit: 1,
    include_docs: true,
}))), Effect.map(({ rows }) => rows), Effect.map(Option.liftPredicate(Array.isNonEmptyArray)), Effect.map(Option.map(([{ doc }]) => doc)), Effect.map(Option.flatMap(Option.fromNullable)), Effect.map(Option.flatMap(Schema.decodeUnknownOption(UpgradeLog))));
const streamChangesFeed = (upgradeLogId) => PouchDBService
    .get('medic-logs')
    .pipe(Effect.map(streamChanges({
    include_docs: true,
    doc_ids: [upgradeLogId]
})));
const streamUpgradeLogChanges = (completedStates) => latestUpgradeLog
    .pipe(Effect.map(Option.getOrThrowWith(() => new Error('No upgrade log found'))), Effect.flatMap(({ _id }) => streamChangesFeed(_id)), Effect.map(Stream.retry(Schedule.spaced(1000))), Effect.map(Stream.map(({ doc }) => doc)), Effect.map(Stream.map(Schema.decodeUnknownSync(UpgradeLog))), Effect.map(Stream.takeUntil(({ state }) => completedStates.includes(state))));
const serviceContext = Effect
    .all([
    ChtClientService,
    PouchDBService,
])
    .pipe(Effect.map(([chtClient, pouch,]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(ChtClientService, chtClient))));
const assertReadyForUpgrade = latestUpgradeLog.pipe(Effect.map(Option.map(({ state }) => state)), Effect.map(Match.value), Effect.map(Match.when(Option.isNone, () => Effect.void)), Effect.map(Match.when(state => COMPLETED_STATES.includes(Option.getOrThrow(state)), () => Effect.void)), Effect.flatMap(Match.orElse(() => Effect.fail(new Error('Upgrade already in progress.')))));
const assertReadyForComplete = latestUpgradeLog.pipe(Effect.map(Option.map(({ state }) => state)), Effect.map(Match.value), Effect.map(Match.when(state => Option.isSome(state) && Option.getOrThrow(state) === 'indexed', () => Effect.void)), Effect.flatMap(Match.orElse(() => Effect.fail(new Error('No upgrade ready for completion.')))));
export class UpgradeService extends Effect.Service()('chtoolbox/UpgradeService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        upgrade: (version) => assertReadyForUpgrade.pipe(Effect.andThen(upgradeCht(version)), Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)), Effect.provide(context)),
        stage: (version) => assertReadyForUpgrade.pipe(Effect.andThen(stageChtUpgrade(version)), Effect.andThen(streamUpgradeLogChanges(STAGING_COMPLETE_STATES)), Effect.provide(context)),
        complete: (version) => assertReadyForComplete.pipe(Effect.andThen(completeChtUpgrade(version)), Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)
            .pipe(Effect.retry(Schedule.spaced(1000)))), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=upgrade.js.map