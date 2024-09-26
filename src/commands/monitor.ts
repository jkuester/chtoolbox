import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { initializeUrl } from '../index';
import { MonitorService } from '../services/monitor';

const printCsvRow = (row: readonly (string | number | boolean)[]) => pipe(
  row,
  Array.map(value => String(value)),
  Array.join(','),
  Console.log
);

const monitorData = (monitor: MonitorService, interval: number, trackDirSize: Option.Option<string>) => pipe(
  monitor.getAsCsv(trackDirSize),
  Effect.tap(printCsvRow),
  Effect.catchAll(Console.error),
  Effect.delay(interval * 1000)
);

const interval = Options
  .integer('interval')
  .pipe(
    Options.withAlias('i'),
    Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'),
    Options.withDefault(1),
  );

const trackDirSize = Options
  .directory('track-dir-size', { exists: 'yes' })
  .pipe(
    Options.withDescription(
      'The local directory to monitor disk usage. (Useful when monitoring a locally deployed CHT instance.)'
    ),
    Options.optional,
  );

export const monitor = Command
  .make('monitor', { interval, trackDirSize }, ({ interval, trackDirSize }) => pipe(
    initializeUrl,
    Effect.andThen(MonitorService),
    Effect.tap(monitor => pipe(
      monitor.getCsvHeader(trackDirSize),
      printCsvRow,
      Effect.andThen(Effect.repeat(monitorData(monitor, interval, trackDirSize), { until: () => false }))
    )),
  ))
  .pipe(Command.withDescription(`Poll CHT metrics.`));
