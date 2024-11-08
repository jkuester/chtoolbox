import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, streamChanges } from './pouchdb';
import { Array, DateTime, Match, Option, Schedule, Schema, Stream } from 'effect';
import { ChtUpgradeService } from './cht/upgrade';

const UPGRADE_LOG_NAME = 'upgrade_log';
const COMPLETED_STATES = ['finalized', 'aborted', 'errored', 'interrupted'];
const STAGING_COMPLETE_STATES = ['indexed', ...COMPLETED_STATES];
const UPGRADE_LOG_STATES = [
  'initiated',
  'staged',
  'indexing',
  'completing',
  'finalizing',
  'complete',
  'aborting',
  ...STAGING_COMPLETE_STATES,
];

export class UpgradeLog extends Schema.Class<UpgradeLog>('UpgradeLog')({
  _id: Schema.String,
  state: Schema.Literal(...UPGRADE_LOG_STATES),
  state_history: Schema.Array(Schema.Struct({
    state: Schema.Literal(...UPGRADE_LOG_STATES),
    date: Schema.Number,
  })),
}) {
}

const latestUpgradeLog = PouchDBService
  .get('medic-logs')
  .pipe(
    Effect.flatMap(db => Effect.tryPromise(() => db.allDocs({
      startkey: `${UPGRADE_LOG_NAME}:${DateTime.unsafeNow().epochMillis.toString()}:`,
      endkey: `${UPGRADE_LOG_NAME}:0:`,
      descending: true,
      limit: 1,
      include_docs: true,
    }))),
    Effect.map(({ rows }) => rows),
    Effect.map(Option.liftPredicate(Array.isNonEmptyArray)),
    Effect.map(Option.map(([{ doc }]) => doc)),
    Effect.map(Option.flatMap(Option.fromNullable)),
    Effect.map(Option.flatMap(Schema.decodeUnknownOption(UpgradeLog))),
  );

const streamChangesFeed = (upgradeLogId: string) => PouchDBService
  .get('medic-logs')
  .pipe(
    Effect.map(streamChanges({
      include_docs: true,
      doc_ids: [upgradeLogId]
    })),
  );

const streamUpgradeLogChanges = (completedStates: string[]) => latestUpgradeLog
  .pipe(
    Effect.map(Option.getOrThrowWith(() => new Error('No upgrade log found'))),
    Effect.flatMap(({ _id }) => streamChangesFeed(_id)),
    Effect.map(Stream.retry(Schedule.spaced(1000))),
    Effect.map(Stream.map(({ doc }) => doc)),
    Effect.map(Stream.map(Schema.decodeUnknownSync(UpgradeLog))),
    Effect.map(Stream.takeUntil(({ state }: UpgradeLog) => completedStates.includes(state))),
  );

const serviceContext = Effect
  .all([
    ChtUpgradeService,
    PouchDBService,
  ])
  .pipe(Effect.map(([
    upgrade,
    pouch,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(ChtUpgradeService, upgrade))));

const assertReadyForUpgrade = latestUpgradeLog.pipe(
  Effect.map(Option.map(({ state }) => state)),
  Effect.map(Match.value),
  Effect.map(Match.when(Option.isNone, () => Effect.void)),
  Effect.map(Match.when(state => COMPLETED_STATES.includes(Option.getOrThrow(state)), () => Effect.void)),
  Effect.flatMap(Match.orElse(() => Effect.fail(new Error('Upgrade already in progress.')))),
);

const assertReadyForComplete = latestUpgradeLog.pipe(
  Effect.map(Option.map(({ state }) => state)),
  Effect.map(Match.value),
  Effect.map(Match.when(state => Option.isSome(state) && Option.getOrThrow(state) === 'indexed', () => Effect.void)),
  Effect.flatMap(Match.orElse(() => Effect.fail(new Error('No upgrade ready for completion.')))),
);

type UpgradeLogStreamEffect = Effect.Effect<Stream.Stream<UpgradeLog, Error>, Error>;

export class UpgradeService extends Effect.Service<UpgradeService>()('chtoolbox/UpgradeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    upgrade: (version: string): UpgradeLogStreamEffect => assertReadyForUpgrade.pipe(
      Effect.andThen(ChtUpgradeService.upgrade(version)),
      Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)),
      Effect.provide(context),
    ),
    stage: (version: string): UpgradeLogStreamEffect => assertReadyForUpgrade.pipe(
      Effect.andThen(ChtUpgradeService.stage(version)),
      Effect.andThen(streamUpgradeLogChanges(STAGING_COMPLETE_STATES)),
      Effect.provide(context),
    ),
    complete: (version: string): UpgradeLogStreamEffect => assertReadyForComplete.pipe(
      Effect.andThen(ChtUpgradeService.complete(version)),
      Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)
        .pipe(
          Effect.retry(Schedule.spaced(1000)), // Getting the upgrade log may fail while the server is still restarting
        )),
      Effect.provide(context),
    ),
  }))),
  accessors: true,
}) {
}
