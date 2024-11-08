import { Args, Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Match, Option, pipe, Stream } from 'effect';
import { initializeUrl } from '../index';
import { UpgradeLog, UpgradeService } from '../services/upgrade';
import { clearThen } from '../libs/core';

const getUpgradeLogDisplay = ({ state_history }: UpgradeLog) => pipe(
  state_history,
  Array.map(({ state, date }) => ({
    state,
    time: DateTime
      .unsafeMake(date)
      .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
  })),
  Array.reduce({}, (acc, { state, time }) => ({ ...acc, [state]: { time } })),
);

const streamUpgradeLog = (stream: Stream.Stream<UpgradeLog, Error>) => stream.pipe(
  Stream.map(getUpgradeLogDisplay),
  Stream.tap(log => clearThen(Console.table(log))),
  Stream.runDrain,
);

const printUpgradeLogId = (stream: Stream.Stream<UpgradeLog, Error>) => stream.pipe(
  Stream.take(1),
  Stream.tap(log => clearThen(Console.log(`Upgrade started. Check the medic-logs doc for progress: ${log._id}`))),
  Stream.runDrain,
);

const getUpgradeAction = (opts: { stage: boolean, complete: boolean, version: string }) => Match
  .value(opts)
  .pipe(
    Match.when({ stage: true }, ({ version }) => UpgradeService.stage(version)),
    Match.when({ complete: true }, ({ version }) => UpgradeService.complete(version)),
    Match.orElse(({ version }) => UpgradeService.upgrade(version)),
  );

const getStreamAction = (follow: boolean) => Option
  .liftPredicate(streamUpgradeLog, () => follow)
  .pipe(Option.getOrElse(() => printUpgradeLogId));

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering upgrade, wait for it to complete.'),
    Options.withDefault(false),
  );

const stage = Options
  .boolean('stage')
  .pipe(
    Options.withDescription('Stage the upgrade without actually running it.'),
    Options.withDefault(false),
  );

const complete = Options
  .boolean('complete')
  .pipe(
    Options.withDescription('Complete a staged upgrade.'),
    Options.withDefault(false),
  );

const version = Args
  .text({ name: 'version' })
  .pipe(
    Args.withDescription('The CHT version to upgrade to'),
  );

export const upgrade = Command
  .make('upgrade', { version, follow, stage, complete }, (opts) => initializeUrl.pipe(
    Effect.andThen(getUpgradeAction(opts)),
    Effect.flatMap(getStreamAction(opts.follow)),
  ))
  .pipe(Command.withDescription(`Run compaction on all databases and views.`));
