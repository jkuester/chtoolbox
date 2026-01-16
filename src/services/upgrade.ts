import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { getDoc, PouchDBService, saveDoc, streamChanges } from './pouchdb.ts';
import {
  Array,
  Chunk,
  DateTime,
  Function,
  Match,
  Option, Order,
  pipe,
  Record,
  Schedule,
  Schema,
  Stream,
  String,
  Tuple
} from 'effect';
import { completeChtUpgrade, stageChtUpgrade, upgradeCht } from '../libs/cht/upgrade.ts';
import { ChtClientService } from './cht-client.ts';
import { mapErrorToGeneric, mapStreamErrorToGeneric } from '../libs/core.ts';
import { CouchDesign, deleteCouchDesign } from '../libs/couch/design.ts';
import { WarmViewsService } from './warm-views.ts';
import { type CompareCommitsData, compareRefs, getReleaseNames } from '../libs/github.ts';
import { type CouchActiveTaskStream } from '../libs/couch/active-tasks.ts';
import type { NonEmptyArray } from 'effect/Array';
import {
  CHT_DATABASE_BY_ATTACHMENT_NAME,
  CHT_DDOC_ATTACHMENT_NAMES, type ChtDdocDiff,
  type ChtDdocsDiffByDb,
  type DesignDocAttachment,
  getDesignDocAttachments,
  getDesignDocsDiff, getDesignDocsDiffWithCurrent
} from '../libs/medic-staging.ts';
import { cleanupDatabaseIndexes } from '../libs/couch/cleanup.ts';
import { CompactService } from './compact.ts';

const UPGRADE_LOG_NAME = 'upgrade_log';
const COMPLETED_STATES = ['finalized', 'aborted', 'errored', 'interrupted'] as const;
const STAGING_COMPLETE_STATES = ['indexed', ...COMPLETED_STATES] as const;
const UPGRADE_LOG_STATES = [
  'initiated',
  'staged',
  'indexing',
  'completing',
  'finalizing',
  'complete',
  'aborting',
  ...STAGING_COMPLETE_STATES,
] as const;
const DDOC_PREFIX = '_design/';
const STAGED_DDOC_PREFIX = ':staged:';

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
      startkey: `${UPGRADE_LOG_NAME}:${DateTime.unsafeNow()
        .epochMillis
        .toString()}:`,
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

const streamChangesFeed = Effect.fn((upgradeLogId: string) => pipe(
  { include_docs: true, doc_ids: [upgradeLogId] },
  streamChanges('medic-logs'),
));

const streamUpgradeLogChanges = Effect.fn((completedStates: readonly string[]) => latestUpgradeLog
  .pipe(
    Effect.map(Option.getOrThrowWith(() => new Error('No upgrade log found'))),
    Effect.flatMap(({ _id }) => streamChangesFeed(_id)),
    Effect.map(Stream.retry(Schedule.spaced(1000))),
    Effect.map(Stream.map(({ doc }) => doc)),
    Effect.map(Stream.map(Schema.decodeUnknownSync(UpgradeLog))),
    Effect.map(Stream.takeUntil(({ state }: UpgradeLog) => completedStates.includes(state))),
  ));

const assertReadyForUpgrade = latestUpgradeLog.pipe(
  Effect.map(Option.map(({ state }) => state)),
  Effect.map(Match.value),
  Effect.map(Match.when(Option.isNone, () => Effect.void)),
  Effect.map(Match.when(state => Array.contains(COMPLETED_STATES, Option.getOrThrow(state)), () => Effect.void)),
  Effect.flatMap(Match.orElse(() => Effect.fail(new Error('Upgrade already in progress.')))),
);

const assertReadyForComplete = latestUpgradeLog.pipe(
  Effect.map(Option.map(({ state }) => state)),
  Effect.map(Match.value),
  Effect.map(Match.when(state => Option.isSome(state) && Option.getOrThrow(state) === 'indexed', () => Effect.void)),
  Effect.flatMap(Match.orElse(() => Effect.fail(new Error('No upgrade ready for completion.')))),
);


const getExistingStagedDdocRev = Effect.fn((dbName: string, ddocId: string) => pipe(
  ddocId,
  String.replace(DDOC_PREFIX, `${DDOC_PREFIX}${STAGED_DDOC_PREFIX}`),
  getDoc(dbName),
  Effect.tap(doc => pipe(
    doc,
    Option.map(doc => Effect.logDebug(`Found existing staged ddoc ${doc._id} with rev ${doc._rev}`)),
    Option.getOrElse(() => Effect.logDebug(`No existing staged ddoc found for ${ddocId}`)),
  )),
  Effect.map(Option.map(({ _rev }) => ({ _rev }))),
  Effect.map(Option.getOrElse(() => ({ }))),
));

const saveStagedDdoc = Effect.fn((dbName: string, ddoc: CouchDesign) => Effect
  .logDebug(`Saving staging ddoc for ${dbName}/${ddoc._id}`)
  .pipe(
    Effect.andThen(getExistingStagedDdocRev(dbName, ddoc._id)),
    Effect.map(existingDdoc => ({
      ...existingDdoc,
      ...ddoc,
      _id: pipe(ddoc._id, String.replace(DDOC_PREFIX, `${DDOC_PREFIX}${STAGED_DDOC_PREFIX}`)),
      deploy_info: { user: 'Pre-staged by chtoolbox' }
    })),
    Effect.flatMap(saveDoc(dbName)),
  ));

const preStageDdoc = (dbName: string) => Effect.fn((ddoc: CouchDesign) => WarmViewsService
  .warmDesign(dbName, pipe(ddoc._id, String.replace(DDOC_PREFIX, STAGED_DDOC_PREFIX)))
  .pipe(Effect.map(Stream.onStart(saveStagedDdoc(dbName, ddoc)))));

const preStageDdocs = Effect.fn((docsByDb: [DesignDocAttachment, typeof CHT_DDOC_ATTACHMENT_NAMES[number]][]) => pipe(
  docsByDb,
  Array.map(([{ docs }, attachmentName]) => pipe(
    docs,
    Array.map(preStageDdoc(CHT_DATABASE_BY_ATTACHMENT_NAME[attachmentName])),
    Effect.all,
    Effect.map(Chunk.fromIterable),
    Effect.map(Stream.concatAll),
  )),
  Effect.all,
  Effect.map(Chunk.fromIterable),
  Effect.map(Stream.concatAll),
));

const getChtCoreDiff = compareRefs('medic', 'cht-core');
const getChtCoreReleaseNames = getReleaseNames('medic', 'cht-core');

const getUpdatedDdocNamesByDb = (diffByDb: ChtDdocsDiffByDb): Record<string, NonEmptyArray<string>> => pipe(
  Record.toEntries(diffByDb),
  Array.map(([db, { updated, created }]) => Tuple.make(
    db,
    pipe(
      [...created, ...updated],
      Array.map(({ _id }) => _id.replace('_design/', ''))
    )
  )),
  Array.filter(([, ddocs]) => Array.isNonEmptyArray(ddocs)),
  Record.fromEntries,
) as Record<string, NonEmptyArray<string>>;

const getReleaseNotesLink = (tag: string) => pipe(
  tag,
  String.replaceAll('.', '_'),
  version => `https://docs.communityhealthtoolkit.org/releases/${version}`
);

const getReleaseNotesLinksByTag = (releaseNames: string[]) => pipe(
  releaseNames,
  Array.reduce({}, (acc, tag) => Record.set(acc, tag, getReleaseNotesLink(tag))),
);

export interface ChtCoreReleaseDiff {
  updatedDdocs: Record<string, NonEmptyArray<string>>;
  htmlUrl: string;
  fileChangeCount: number,
  commitCount: number,
  releaseDocLinksByTag: Record<string, string>;
}

const getReleaseDiff = (
  ddocDiff: ChtDdocsDiffByDb,
  diffData: CompareCommitsData,
  releaseNames: string[]
): ChtCoreReleaseDiff => ({
  updatedDdocs: getUpdatedDdocNamesByDb(ddocDiff),
  htmlUrl: diffData.html_url,
  fileChangeCount: (diffData.files ?? []).length,
  commitCount: diffData.commits.length,
  releaseDocLinksByTag: getReleaseNotesLinksByTag(releaseNames)
});

const serviceContext = Effect
  .all([
    ChtClientService,
    PouchDBService,
    WarmViewsService,
    CompactService
  ])
  .pipe(Effect.map(([
    chtClient,
    pouch,
    warmViews,
    compact
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(
      Context.add(ChtClientService, chtClient),
      Context.add(WarmViewsService, warmViews),
      Context.add(CompactService, compact)
    )));

type UpgradeLogStreamEffect = Effect.Effect<Stream.Stream<UpgradeLog, Error>, Error>;

const removeOutdatedDdocs = (dbName: string, diff: ChtDdocDiff) => pipe(
  [...diff.updated, ...diff.deleted],
  Array.map(deleteCouchDesign(dbName)),
  Effect.allWith({ concurrency: 'unbounded' }),
  Effect.andThen(() => cleanupDatabaseIndexes(dbName))
);

const removeAllOutdatedDdocs = Effect.fn((diffByDb: ChtDdocsDiffByDb) => pipe(
  Record.toEntries(diffByDb),
  Array.map(Function.tupled(removeOutdatedDdocs)),
  Effect.allWith({ concurrency: 'unbounded' }),
));

const installDdoc = (dbName: string) => (ddoc: CouchDesign) => pipe(
  Effect.logDebug(`Warming ${dbName} ddoc: ${ddoc._id}`),
  Effect.andThen(WarmViewsService.warmDesign(dbName, pipe(ddoc._id, String.replace(DDOC_PREFIX, '')))),
  Effect.map(Stream.onStart(pipe(
    Effect.logDebug(`Saving ${dbName} ddoc: ${ddoc._id}`),
    Effect.andThen(ddoc),
    Effect.flatMap(saveDoc(dbName))
  ))),
  Effect.zip(pipe(
    Effect.logDebug(`Compacting ddoc: ${ddoc._id}`),
    Effect.andThen(() => CompactService.compactDdoc(dbName, pipe(ddoc._id, String.replace(DDOC_PREFIX, '')))),
    x => x,
  )),
  // Effect.map(Stream.concatAll),
  // warmStream => Effect.all([warmStream, CompactService.compactDdoc(dbName, '')]),
  Effect.map(([s1, s2]) => Stream.concat(s1, s2)),
  // Effect.map(Stream.concat(CompactService.compactDdoc(dbName, pipe(ddoc._id, String.replace(DDOC_PREFIX, '')))))
);

const warmUpdatedDdocs = (diffByDb: ChtDdocsDiffByDb) => pipe(
  Record.toEntries(diffByDb),
  Array.sortBy(
    Order.mapInput((self: string) => self === 'medic' ? -1 : 0, Tuple.getFirst),
    Order.mapInput(Order.string, Tuple.getFirst),
  ),
  Array.map(Tuple.mapSecond(({ created, updated }) => [...created, ...updated])),
  Array.filter(([, ddocs]) => Array.isNonEmptyArray(ddocs)),
  Array.map(([dbName, ddocs]) => pipe(
    ddocs,
    Array.sortBy(
      Order.mapInput(
        (self: string) => self === '_design/medic-client' ? -1 : 0,
        ({ _id }) => _id,
      ),
      Order.mapInput(Order.string, ({ _id }) => _id),
    ),
    Array.map(ddoc => ({...ddoc, _rev: undefined })),
    Array.map(installDdoc(dbName)),
    Effect.all,
    Effect.map(Chunk.fromIterable),
    Effect.map(Stream.concatAll),
  )),
  Effect.all,
  Effect.map(Chunk.fromIterable),
  Effect.map(Stream.concatAll),
);

export class UpgradeService extends Effect.Service<UpgradeService>()('chtoolbox/UpgradeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    upgrade: Effect.fn((version: string): UpgradeLogStreamEffect => assertReadyForUpgrade.pipe(
      Effect.andThen(upgradeCht(version)),
      Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    stage: Effect.fn((version: string): UpgradeLogStreamEffect => assertReadyForUpgrade.pipe(
      Effect.andThen(stageChtUpgrade(version)),
      Effect.andThen(streamUpgradeLogChanges(STAGING_COMPLETE_STATES)),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    complete: Effect.fn((version: string): UpgradeLogStreamEffect => assertReadyForComplete.pipe(
      Effect.andThen(completeChtUpgrade(version)),
      Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)
        .pipe(
          Effect.retry(Schedule.spaced(1000)), // Getting the upgrade log may fail while the server is still restarting
        )),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    preStage: Effect.fn((version: string): Effect.Effect<CouchActiveTaskStream, Error> => assertReadyForUpgrade.pipe(
      Effect.andThen(getDesignDocAttachments(version)),
      Effect.flatMap(preStageDdocs),
      Effect.map(Stream.provideContext(context)),
      Effect.map(mapStreamErrorToGeneric),
      Effect.provide(context),
    )),
    upgradeDdocs: Effect.fn((
      version: string
    ): Effect.Effect<CouchActiveTaskStream, Error> => assertReadyForUpgrade.pipe(
      Effect.andThen(getDesignDocsDiffWithCurrent(version)),
      Effect.tap(removeAllOutdatedDdocs),
      Effect.flatMap(warmUpdatedDdocs),
      Effect.map(Stream.provideContext(context)),
      Effect.map(mapStreamErrorToGeneric),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    getReleaseDiff: Effect.fn((
      baseTag: string,
      headTag: string
    ): Effect.Effect<ChtCoreReleaseDiff, Error> => pipe(
      Tuple.make(
        getDesignDocsDiff(baseTag, headTag),
        getChtCoreDiff(baseTag, headTag),
        getChtCoreReleaseNames(baseTag, headTag),
      ),
      Effect.allWith({ concurrency: 'unbounded' }),
      Effect.map(Function.tupled(getReleaseDiff)),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
  }))),
  accessors: true,
}) {
}
