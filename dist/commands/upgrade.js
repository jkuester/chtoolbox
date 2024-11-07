"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgrade = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const upgrade_1 = require("../services/upgrade");
const core_1 = require("../libs/core");
const getUpgradeLogDisplay = ({ state_history }) => (0, effect_1.pipe)(state_history, effect_1.Array.map(({ state, date }) => ({
    state,
    time: effect_1.DateTime
        .unsafeMake(date)
        .pipe(effect_1.DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
})), effect_1.Array.reduce({}, (acc, { state, time }) => ({ ...acc, [state]: { time } })));
const streamUpgradeLog = (stream) => stream.pipe(effect_1.Stream.map(getUpgradeLogDisplay), effect_1.Stream.tap(log => (0, core_1.clearThen)(effect_1.Console.table(log))), effect_1.Stream.runDrain);
const printUpgradeLogId = (stream) => stream.pipe(effect_1.Stream.take(1), effect_1.Stream.tap(log => (0, core_1.clearThen)(effect_1.Console.log(`Upgrade started. Check the medic-logs doc for progress: ${log._id}`))), effect_1.Stream.runDrain);
const getUpgradeAction = (opts) => effect_1.Match
    .value(opts)
    .pipe(effect_1.Match.when({ stage: true }, ({ version }) => upgrade_1.UpgradeService.stage(version)), effect_1.Match.when({ complete: true }, ({ version }) => upgrade_1.UpgradeService.complete(version)), effect_1.Match.orElse(({ version }) => upgrade_1.UpgradeService.upgrade(version)));
const getStreamAction = (follow) => effect_1.Option
    .liftPredicate(streamUpgradeLog, () => follow)
    .pipe(effect_1.Option.getOrElse(() => printUpgradeLogId));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering upgrade, wait for it to complete.'), cli_1.Options.withDefault(false));
const stage = cli_1.Options
    .boolean('stage')
    .pipe(cli_1.Options.withDescription('Stage the upgrade without actually running it.'), cli_1.Options.withDefault(false));
const complete = cli_1.Options
    .boolean('complete')
    .pipe(cli_1.Options.withDescription('Complete a staged upgrade.'), cli_1.Options.withDefault(false));
const version = cli_1.Args
    .text({ name: 'version' })
    .pipe(cli_1.Args.withDescription('The CHT version to upgrade to'));
exports.upgrade = cli_1.Command
    .make('upgrade', { version, follow, stage, complete }, (opts) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(getUpgradeAction(opts)), effect_1.Effect.flatMap(getStreamAction(opts.follow))))
    .pipe(cli_1.Command.withDescription(`Run compaction on all databases and views.`));
//# sourceMappingURL=upgrade.js.map