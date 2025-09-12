import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { getDoc, PouchDBService, saveDoc, streamChanges } from './pouchdb.ts';
import {
  Array,
  Chunk,
  DateTime,
  Either,
  Encoding,
  Match,
  Option,
  pipe,
  Predicate,
  Record,
  Schedule,
  Schema,
  Stream,
  String
} from 'effect';
import { completeChtUpgrade, stageChtUpgrade, upgradeCht } from '../libs/cht/upgrade.ts';
import { ChtClientService } from './cht-client.ts';
import { mapErrorToGeneric, pouchDB } from '../libs/core.ts';
import { CouchDesign } from '../libs/couch/design.ts';
import { WarmViewsService } from './warm-views.ts';
import { type CompareCommitsData, compareRefs } from '../libs/github.ts';
import { type CouchActiveTaskStream } from '../libs/couch/active-tasks.ts';
import type { NonEmptyArray } from 'effect/Array';

type Attachments = PouchDB.Core.Attachments;
type FullAttachment = PouchDB.Core.FullAttachment;

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
const CHT_DATABASES = [
  'medic',
  'medic-sentinel',
  'medic-logs',
  'medic-users-meta',
  '_users'
] as const;
const DDOC_PREFIX = '_design/';
const STAGED_DDOC_PREFIX = ':staged:';
const CHT_DDOC_ATTACHMENT_NAMES = [
  'ddocs/medic.json',
  'ddocs/sentinel.json',
  'ddocs/logs.json',
  'ddocs/users-meta.json',
  'ddocs/users.json'
] as const;
const STAGING_BUILDS_COUCH_URL = 'https://staging.dev.medicmobile.org/_couch/builds_4';
const CHT_DATABASE_BY_ATTACHMENT_NAME: Record<
  typeof CHT_DDOC_ATTACHMENT_NAMES[number],
  typeof CHT_DATABASES[number]
> = pipe(
  CHT_DDOC_ATTACHMENT_NAMES,
  Array.zip(CHT_DATABASES),
  Record.fromEntries,
);

export class UpgradeLog extends Schema.Class<UpgradeLog>('UpgradeLog')({
  _id: Schema.String,
  state: Schema.Literal(...UPGRADE_LOG_STATES),
  state_history: Schema.Array(Schema.Struct({
    state: Schema.Literal(...UPGRADE_LOG_STATES),
    date: Schema.Number,
  })),
}) {
}

class DesignDocAttachment extends Schema.Class<DesignDocAttachment>('DesignDocAttachment')({
  docs: Schema.Array(CouchDesign),
}) {
  static readonly decode = (attachment: FullAttachment) => pipe(
    attachment.data as string,
    Encoding.decodeBase64String,
    Either.getOrThrow,
    JSON.parse,
    Schema.decodeUnknown(DesignDocAttachment),
  );
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

const getStagingDocAttachments = Effect.fn((version: string) => Effect
  .logDebug(`Getting staging doc attachments for ${version}`)
  .pipe(
    Effect.andThen(pouchDB(STAGING_BUILDS_COUCH_URL)),
    Effect.flatMap(db => Effect.promise(() => db.get(`medic:medic:${version}`, { attachments: true }))),
    Effect.map(({ _attachments }) => _attachments),
    Effect.filterOrFail(Predicate.isNotNullable),
  ));

const decodeStagingDocAttachments = Effect.fn((attachments: Attachments) => pipe(
  CHT_DDOC_ATTACHMENT_NAMES,
  Array.map(name => attachments[name] as FullAttachment),
  Array.map(DesignDocAttachment.decode),
  Effect.allWith({ concurrency: 'unbounded' }),
));

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

const lastFilenameAfterDdocs = (files: { filename: string }[]) => pipe(
  files,
  Array.last,
  Option.map(({ filename }) => filename),
  Option.filter(Predicate.not(String.startsWith('ddocs/'))),
  Option.map(String.localeCompare('ddocs/')),
  Option.filter(order => order === 1),
  Option.isSome
);

const assertDdocDataInBounds = Effect.fn((data: CompareCommitsData) => pipe(
  Match.value(data),
  Match.whenOr(
    { files: Predicate.isNullable },
    { files: ({ length }) => length < 300 },
    { files: lastFilenameAfterDdocs },
    () => Effect.succeed(data)
  ),
  Match.orElse(() => Effect.fail('Cannot calculate release diff as too many files have changed.')),
));

const DDOC_PATTERN = /^ddocs\/([^/]+)-db\/([^/]+)\/.*(?:map|reduce)\.js$/;

const getUpdatedDdocsByDb = ({ files }: CompareCommitsData) => pipe(
  files ?? [],
  Array.map(({ filename }) => filename),
  Array.map(String.match(DDOC_PATTERN)),
  Array.map(Option.map(([, db, ddoc]) => [db, ddoc])),
  Array.map(Option.filter((data): data is [string, string] => Array.every(data, Predicate.isNotNullable))),
  Array.getSomes,
  Array.groupBy(([db]) => db),
  Record.map(Array.map(([, ddoc]) => ddoc)),
  Record.map(Array.dedupe)
);

export interface ChtCoreReleaseDiff {
  updatedDdocs: Record<string, NonEmptyArray<string>>;
  htmlUrl: string
}

const getReleaseDiff = (diffData: CompareCommitsData): ChtCoreReleaseDiff => ({
  updatedDdocs: getUpdatedDdocsByDb(diffData),
  htmlUrl: diffData.html_url,
});

const serviceContext = Effect
  .all([
    ChtClientService,
    PouchDBService,
    WarmViewsService,
  ])
  .pipe(Effect.map(([
    chtClient,
    pouch,
    warmViews,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(
      Context.add(ChtClientService, chtClient),
      Context.add(WarmViewsService, warmViews)
    )));

type UpgradeLogStreamEffect = Effect.Effect<Stream.Stream<UpgradeLog, Error>, Error>;

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
      Effect.andThen(getStagingDocAttachments(version)),
      Effect.flatMap(decodeStagingDocAttachments),
      Effect.map(Array.zip(CHT_DDOC_ATTACHMENT_NAMES)),
      Effect.flatMap(preStageDdocs),
      Effect.map(Stream.provideContext(context)),
      Effect.map(Stream.mapError(x => x as Error)),
      Effect.provide(context),
    )),
    getReleaseDiff: Effect.fn((
      baseTag: string,
      headTag: string
    ): Effect.Effect<ChtCoreReleaseDiff, Error> => pipe(
      getChtCoreDiff(baseTag, headTag),
      Effect.flatMap(assertDdocDataInBounds),
      Effect.map(getReleaseDiff),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
  }))),
  accessors: true,
}) {
}
