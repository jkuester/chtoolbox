import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe, Schedule } from 'effect';
import { initializeUrl } from '../index.ts';
import { MonitorService } from '../services/monitor.ts';

const printCsvRow = Effect.fn((row: readonly (string | number | boolean)[]) => pipe(
  row,
  Array.map(value => String(value)),
  Array.join(','),
  Console.log
));

const monitorData = Effect.fn((trackDirSize: Option.Option<string>) => pipe(
  MonitorService.getAsCsv(trackDirSize),
  Effect.tap(printCsvRow),
  Effect.catchAll(Console.error),
));

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
  .make('monitor', { interval, trackDirSize }, Effect.fn(({ interval, trackDirSize }) => pipe(
    initializeUrl,
    Effect.andThen(MonitorService.getCsvHeader(trackDirSize)),
    Effect.tap(printCsvRow),
    Effect.andThen(Effect.repeat(monitorData(trackDirSize), Schedule.spaced(interval * 1000))),
  )))
  .pipe(Command.withDescription(`Poll CHT metrics.`));
