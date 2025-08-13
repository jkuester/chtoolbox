import { Args, Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Match, pipe, Schedule, Stream } from 'effect';
import { initializeUrl } from "../index.js";
import { UpgradeLog, UpgradeService } from "../services/upgrade.js";
import { clearConsole, clearThen } from "../libs/console.js";
import { getDisplayDictByPid } from "../libs/couch/active-tasks.js";
import { getTaskDisplayData } from "./db/compact.js";
const getUpgradeLogDisplay = ({ state_history }) => pipe(state_history, Array.map(({ state, date }) => ({
    state,
    time: DateTime
        .unsafeMake(date)
        .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
})), Array.reduce({}, (acc, { state, time }) => ({ ...acc, [state]: { time } })));
const streamUpgradeLog = Effect.fn((stream) => stream.pipe(Stream.map(getUpgradeLogDisplay), Stream.tap(log => clearThen(Console.table(log))), Stream.runDrain));
const printUpgradeLogId = Effect.fn((stream) => stream.pipe(Stream.take(1), Stream.tap(log => clearThen(Console.log(`Upgrade started. Check the medic-logs doc for progress: ${log._id}`))), Stream.runDrain));
const getUpgradeAction = Effect.fn((opts) => Match
    .value(opts)
    .pipe(Match.when({ preStage: true }, ({ version }) => UpgradeService.preStage(version)), Match.when({ stage: true }, ({ version }) => UpgradeService.stage(version)), Match.when({ complete: true }, ({ version }) => UpgradeService.complete(version)), Match.orElse(({ version }) => UpgradeService.upgrade(version))));
const getCurrentTime = () => DateTime
    .unsafeNow()
    .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
const streamActiveTasks = Effect.fn((taskStream) => taskStream.pipe(Stream.map(Array.map(getTaskDisplayData)), Stream.map(getDisplayDictByPid), Stream.tapError(e => Effect.logError(`${JSON.stringify(e, null, 2)}\n\nRetrying...`)), Stream.retry(Schedule.spaced(5000)), Stream.runForEach(taskDict => clearConsole.pipe(Effect.tap(Console.log(`Currently indexing: [${getCurrentTime()}]`)), Effect.tap(Console.table(taskDict)))), Effect.tap(clearThen(Console.log('Pre-staging complete.')))));
const getStreamAction = (opts) => Effect.fn((stream) => Match
    .value(opts)
    .pipe(Match.when({ preStage: true, follow: false }, () => Effect.fail('Cannot pre-stage without actively following the progress. The with the -f option must be used.')), Match.when({ preStage: true, follow: true }, () => streamActiveTasks(stream)), Match.when({ follow: true }, () => streamUpgradeLog(stream)), Match.orElse(() => printUpgradeLogId(stream))));
const follow = Options
    .boolean('follow')
    .pipe(Options.withAlias('f'), Options.withDescription('After triggering upgrade, wait for it to complete.'));
const preStage = Options
    .boolean('pre-stage')
    .pipe(Options.withDescription('NOT REQUIRED for doing a normal upgrade. This option should not be used in most cases.' +
    'Pre-staging will manually stage the new indexes for the upgrade and warm them one design doc at a time. This ' +
    'will take longer than just staging the upgrade (which indexes all design docs at the same time). However, it ' +
    'requires less available system resources and so may be preferable in some cases.' +
    'The -f option must be used with this option (because an active connection is required to stage each ddoc.'));
const stage = Options
    .boolean('stage')
    .pipe(Options.withDescription('Stage the upgrade without actually running it.'));
const complete = Options
    .boolean('complete')
    .pipe(Options.withDescription('Complete a staged upgrade.'));
const version = Args
    .text({ name: 'version' })
    .pipe(Args.withDescription('The CHT version to upgrade to'));
export const upgrade = Command
    .make('upgrade', { version, follow, stage, complete, preStage }, Effect.fn((opts) => initializeUrl.pipe(Effect.andThen(getUpgradeAction(opts)), Effect.flatMap(getStreamAction(opts)))))
    .pipe(Command.withDescription(`Run compaction on all databases and views.`));
