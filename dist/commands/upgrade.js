import { Args, Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Match, Option, pipe, Stream } from 'effect';
import { initializeUrl } from '../index.js';
import { UpgradeService } from '../services/upgrade.js';
import { clearThen } from '../libs/console.js';
const getUpgradeLogDisplay = ({ state_history }) => pipe(state_history, Array.map(({ state, date }) => ({
    state,
    time: DateTime
        .unsafeMake(date)
        .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
})), Array.reduce({}, (acc, { state, time }) => ({ ...acc, [state]: { time } })));
const streamUpgradeLog = (stream) => stream.pipe(Stream.map(getUpgradeLogDisplay), Stream.tap(log => clearThen(Console.table(log))), Stream.runDrain);
const printUpgradeLogId = (stream) => stream.pipe(Stream.take(1), Stream.tap(log => clearThen(Console.log(`Upgrade started. Check the medic-logs doc for progress: ${log._id}`))), Stream.runDrain);
const getUpgradeAction = (opts) => Match
    .value(opts)
    .pipe(Match.when({ stage: true }, ({ version }) => UpgradeService.stage(version)), Match.when({ complete: true }, ({ version }) => UpgradeService.complete(version)), Match.orElse(({ version }) => UpgradeService.upgrade(version)));
const getStreamAction = (follow) => Option
    .liftPredicate(streamUpgradeLog, () => follow)
    .pipe(Option.getOrElse(() => printUpgradeLogId));
const follow = Options
    .boolean('follow')
    .pipe(Options.withAlias('f'), Options.withDescription('After triggering upgrade, wait for it to complete.'));
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
    .make('upgrade', { version, follow, stage, complete }, (opts) => initializeUrl.pipe(Effect.andThen(getUpgradeAction(opts)), Effect.flatMap(getStreamAction(opts.follow))))
    .pipe(Command.withDescription(`Run compaction on all databases and views.`));
//# sourceMappingURL=upgrade.js.map