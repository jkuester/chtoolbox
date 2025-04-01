import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, pipe, Schedule } from 'effect';
import { initializeUrl } from '../index.js';
import { MonitorService } from '../services/monitor.js';
const printCsvRow = (row) => pipe(row, Array.map(value => String(value)), Array.join(','), Console.log);
const monitorData = (trackCouchDbDirSize, trackNouveauDirSize) => pipe(MonitorService.getAsCsv(trackCouchDbDirSize, trackNouveauDirSize), Effect.tap(printCsvRow), Effect.catchAll(Console.error));
const interval = Options
    .integer('interval')
    .pipe(Options.withAlias('i'), Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'), Options.withDefault(1));
const trackCouchDbDirSize = Options
    .directory('track-dir-size', { exists: 'yes' })
    .pipe(Options.withDescription('The local directory to monitor disk usage. (Useful when monitoring a locally deployed CHT instance.)'), Options.optional);
const trackNouveauDirSize = Options
    .directory('track-nouveau-dir-size', { exists: 'yes' })
    .pipe(Options.withDescription('The local Nouveau directory to monitor disk usage. (Useful when monitoring a locally deployed CHT instance.)'), Options.optional);
export const monitor = Command.make('monitor', { interval, trackCouchDbDirSize, trackNouveauDirSize }, ({ interval, trackCouchDbDirSize, trackNouveauDirSize }) => pipe(initializeUrl, Effect.andThen(MonitorService.getCsvHeader(trackCouchDbDirSize, trackNouveauDirSize)), Effect.tap(printCsvRow), Effect.andThen(Effect.repeat(monitorData(trackCouchDbDirSize, trackNouveauDirSize), Schedule.spaced(interval * 1000))))).pipe(Command.withDescription(`Poll CHT metrics.`));
//# sourceMappingURL=monitor.js.map