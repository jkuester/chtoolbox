import { Args, Command, Options } from '@effect/cli';
import { Array, Console, DateTime, Effect, Match, Option, pipe, Record, Schedule, Stream } from 'effect';
import { initializeUrl } from '../index.ts';
import { type ChtCoreReleaseDiff, UpgradeLog, UpgradeService } from '../services/upgrade.ts';

import { clearConsoleEffect, clearThen, color } from '../libs/console.ts';
import { type CouchActiveTaskStream, getDisplayDictByPid } from '../libs/couch/active-tasks.ts';
import { getTaskDisplayData } from './db/compact.ts';
import type { NonEmptyArray } from 'effect/Array';

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

const diff = Options
  .text('diff')
  .pipe(
    Options.withDescription(
      'Base version to compare against the targeted upgrade version. This is similar to the --preview option.'
    ),
    Options.optional
  );

const version = Args
  .text({ name: 'version' })
  .pipe(
    Args.withDescription('The CHT version to upgrade to'),
  );

const printChangedDdocs = (updatedDdocs: Record<string, NonEmptyArray<string>>) => pipe(
  Console.log(`\nDesign documents that will be re-indexed:`),
  Effect.andThen(Console.table(updatedDdocs))
);

const printNoChangedDdocsEffect = Console.log('\nNo design documents will be re-indexed.');

const printDdocChanges = ({ updatedDdocs }: ChtCoreReleaseDiff) => pipe(
  Match.value(updatedDdocs),
  Match.when(Record.isEmptyRecord, () => printNoChangedDdocsEffect),
  Match.orElse(() => printChangedDdocs(updatedDdocs)),
);

const displayReleaseDiff = (headTag: string) => Effect.fn((baseTag: string) => pipe(
  UpgradeService.getReleaseDiff(baseTag, headTag),
  Effect.tap(() => Console.log(`\nComparing ${color('blue')(baseTag)} -> ${color('green')(headTag)}`)),
  Effect.tap(printDdocChanges),
  Effect.tap(({ htmlUrl }) => Console.log(`\nFull diff: ${htmlUrl}\n`)),
  Effect.asVoid,
));

const validateOptions = (opts: UpgradeOptions) => pipe(
  Match.value(opts),
  Match.whenOr(
    { diff: Option.isSome, follow: true },
    { diff: Option.isSome, stage: true },
    { diff: Option.isSome, complete: true },
    { diff: Option.isSome, preStage: true },
    () => Effect.fail('The --diff option cannot be used with any other options.'),
  ),
  Match.orElse(() => Effect.succeed(opts))
);

interface UpgradeOptions {
  version: string;
  follow: boolean;
  stage: boolean;
  complete: boolean;
  preStage: boolean;
  diff: Option.Option<string>;
}

export const upgrade = Command
  .make('upgrade', { version, follow, stage, complete, preStage, diff }, Effect.fn((opts) => initializeUrl.pipe(
    Effect.andThen(validateOptions(opts)),
    Effect.flatMap(({ diff }) => pipe(
      diff,
      Option.match({
        onNone: () => pipe(
          getUpgradeAction(opts),
          Effect.flatMap(getStreamAction({
            preStage: opts.preStage,
            follow: opts.follow,
          })),
        ),
        onSome: displayReleaseDiff(opts.version),
      })
    )),
    x => x,
  )))
  .pipe(Command.withDescription(`Run compaction on all databases and views.`));
