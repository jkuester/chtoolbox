import { Args, Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Match, pipe, Schedule, Stream } from 'effect';
import { initializeUrl } from '../index.ts';
import { UpgradeLog, UpgradeService } from '../services/upgrade.ts';

import { clearConsoleEffect, clearThen } from '../libs/console.ts';
import { type CouchActiveTaskStream, getDisplayDictByPid } from '../libs/couch/active-tasks.ts';
import { getTaskDisplayData } from './db/compact.ts';

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

const streamUpgradeLog = Effect.fn((stream: Stream.Stream<UpgradeLog, Error>) => stream.pipe(
  Stream.map(getUpgradeLogDisplay),
  Stream.tap(log => clearThen(Console.table(log))),
  Stream.runDrain,
));

const printUpgradeLogId = Effect.fn((stream: Stream.Stream<UpgradeLog, Error>) => stream.pipe(
  Stream.take(1),
  Stream.tap(log => clearThen(Console.log(`Upgrade started. Check the medic-logs doc for progress: ${log._id}`))),
  Stream.runDrain,
));

const getUpgradeAction = Effect.fn((
  opts: { preStage: boolean, stage: boolean, complete: boolean, version: string }
) => Match
  .value(opts)
  .pipe(
    Match.when({ preStage: true }, ({ version }) => UpgradeService.preStage(version)),
    Match.when({ stage: true }, ({ version }) => UpgradeService.stage(version)),
    Match.when({ complete: true }, ({ version }) => UpgradeService.complete(version)),
    Match.orElse(({ version }) => UpgradeService.upgrade(version)),
  ));

const getCurrentTime = () => DateTime
  .unsafeNow()
  .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

const streamActiveTasks = Effect.fn((
  taskStream: CouchActiveTaskStream
) => taskStream.pipe(
  Stream.map(Array.map(getTaskDisplayData)),
  Stream.map(getDisplayDictByPid),
  Stream.tapError(e => Effect.logError(`${JSON.stringify(e, null, 2)}\n\nRetrying...`)),
  Stream.retry(Schedule.spaced(5000)),
  Stream.runForEach(taskDict => clearConsoleEffect.pipe(
    Effect.tap(Console.log(`Currently indexing: [${getCurrentTime()}]`)),
    Effect.tap(Console.table(taskDict)),
  )),
  Effect.tap(clearThen(Console.log('Pre-staging complete.'))),
));

const getStreamAction = (
  opts: { preStage: boolean, follow: boolean }
) => Effect.fn((stream: Stream.Stream<UpgradeLog, Error> | CouchActiveTaskStream) => Match
  .value(opts)
  .pipe(
    Match.when({ preStage: true, follow: false }, () => Effect.fail(
      'Cannot pre-stage without actively following the progress. The with the -f option must be used.'
    )),
    Match.when({ preStage: true, follow: true }, () => streamActiveTasks(stream as CouchActiveTaskStream)),
    Match.when({ follow: true }, () => streamUpgradeLog(stream as Stream.Stream<UpgradeLog, Error>)),
    Match.orElse(() => printUpgradeLogId(stream as Stream.Stream<UpgradeLog, Error>)),
  ));

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering upgrade, wait for it to complete.'),
  );

const preStage = Options
  .boolean('pre-stage')
  .pipe(
    Options.withDescription('NOT REQUIRED for doing a normal upgrade. This option should not be used in most cases.' +
      'Pre-staging will manually stage the new indexes for the upgrade and warm them one design doc at a time. This ' +
      'will take longer than just staging the upgrade (which indexes all design docs at the same time). However, it ' +
      'requires less available system resources and so may be preferable in some cases.' +
      'The -f option must be used with this option (because an active connection is required to stage each ddoc.'),
  );

const stage = Options
  .boolean('stage')
  .pipe(
    Options.withDescription('Stage the upgrade without actually running it.'),
  );

const complete = Options
  .boolean('complete')
  .pipe(
    Options.withDescription('Complete a staged upgrade.'),
  );

const version = Args
  .text({ name: 'version' })
  .pipe(
    Args.withDescription('The CHT version to upgrade to'),
  );

export const upgrade = Command
  .make('upgrade', { version, follow, stage, complete, preStage }, Effect.fn((opts) => initializeUrl.pipe(
    Effect.andThen(getUpgradeAction(opts)),
    Effect.flatMap(getStreamAction(opts)),
  )))
  .pipe(Command.withDescription(`Run compaction on all databases and views.`));
