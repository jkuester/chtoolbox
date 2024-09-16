import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { initializeUrl } from '../index';
import { MonitorService } from '../services/monitor';

const printCsvRow = (row: readonly (string | number | boolean)[]) => pipe(
  row,
  Array.map(value => String(value)),
  Array.join(', '),
  Console.log
);

const monitorData = (monitor: MonitorService, interval: number) => pipe(
  monitor.getAsCsv(),
  Effect.tap(printCsvRow),
  Effect.delay(interval * 1000)
);

const interval = Options
  .integer('interval')
  .pipe(
    Options.withAlias('i'),
    Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'),
    Options.withDefault(1),
  );

export const monitor = Command
  .make('monitor', { interval }, ({ interval }) => pipe(
    initializeUrl,
    Effect.andThen(MonitorService),
    Effect.tap(monitor => pipe(
      monitor.getCsvHeader(),
      printCsvRow,
      Effect.andThen(Effect.repeat(monitorData(monitor, interval), { until: () => false }))
    )),
  ))
  .pipe(
    Command.withDescription(`Poll CHT metrics.`),
  );
