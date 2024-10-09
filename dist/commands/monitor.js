"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitor = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const monitor_1 = require("../services/monitor");
const printCsvRow = (row) => (0, effect_1.pipe)(row, effect_1.Array.map(value => String(value)), effect_1.Array.join(','), effect_1.Console.log);
const monitorData = (monitor, trackDirSize) => (0, effect_1.pipe)(monitor.getAsCsv(trackDirSize), effect_1.Effect.tap(printCsvRow), effect_1.Effect.catchAll(effect_1.Console.error));
const interval = cli_1.Options
    .integer('interval')
    .pipe(cli_1.Options.withAlias('i'), cli_1.Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'), cli_1.Options.withDefault(1));
const trackDirSize = cli_1.Options
    .directory('track-dir-size', { exists: 'yes' })
    .pipe(cli_1.Options.withDescription('The local directory to monitor disk usage. (Useful when monitoring a locally deployed CHT instance.)'), cli_1.Options.optional);
exports.monitor = cli_1.Command
    .make('monitor', { interval, trackDirSize }, ({ interval, trackDirSize }) => (0, effect_1.pipe)(index_1.initializeUrl, effect_1.Effect.andThen(monitor_1.MonitorService), effect_1.Effect.tap(monitor => (0, effect_1.pipe)(monitor.getCsvHeader(trackDirSize), printCsvRow, effect_1.Effect.andThen(effect_1.Effect.repeat(monitorData(monitor, trackDirSize), effect_1.Schedule.spaced(interval * 1000)))))))
    .pipe(cli_1.Command.withDescription(`Poll CHT metrics.`));
//# sourceMappingURL=monitor.js.map