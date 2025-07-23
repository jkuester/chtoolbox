import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { deleteDocs, getAllDocs, PouchDBService, saveDoc, streamChanges } from './pouchdb.js';
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
import { completeChtUpgrade, stageChtUpgrade, upgradeCht } from '../libs/cht/upgrade.js';
import { ChtClientService } from './cht-client.js';
import { pouchDB } from '../libs/core.js';
import { CouchDesign } from '../libs/couch/design.js';
import { WarmViewsService } from './warm-views.js';
import { CouchActiveTaskStream } from '../libs/couch/active-tasks.js';
import Attachments = PouchDB.Core.Attachments;
import FullAttachment = PouchDB.Core.FullAttachment;

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
const CHT_DATABASES = [
  'medic',
  'medic-sentinel',
  'medic-logs',
  'medic-users-meta',
  '_users'
];
const DDOC_PREFIX = '_design/';
const STAGED_DDOC_PREFIX = `${DDOC_PREFIX}:staged:`;
const CHT_DDOC_ATTACMENT_NAMES = [
  'ddocs/medic.json',
  'ddocs/sentinel.json',
  'ddocs/logs.json',
  'ddocs/users-meta.json',
  'ddocs/users.json'
];
const STAGING_BUILDS_COUCH_URL = 'https://staging.dev.medicmobile.org/_couch/builds_4';
const CHT_DATABASE_BY_ATTACHMENT_NAME = pipe(
  CHT_DDOC_ATTACMENT_NAMES,
  Array.zip(CHT_DATABASES),
  Record.fromEntries,
)

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
  )
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

const streamChangesFeed = (upgradeLogId: string) => pipe(
    { include_docs: true, doc_ids: [upgradeLogId] },
    streamChanges('medic-logs'),
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

const deleteStagedDdocs = (dbName: string) => Effect
  .logDebug(`Deleting staging ddocs for ${dbName}.`)
  .pipe(
    Effect.andThen({
      startkey: STAGED_DDOC_PREFIX,
      endkey: `${STAGED_DDOC_PREFIX}\ufff0`
    }),
    Effect.flatMap(getAllDocs(dbName)),
    Effect.map(Option.liftPredicate(Array.isNonEmptyArray)),
    Effect.map(Option.map(deleteDocs(dbName))),
    Effect.flatMap(Option.getOrElse(() => Effect.void)),
  );

const getStagingDocAttachments = (version: string) => Effect
  .logDebug(`Getting staging doc attachments for ${version}`)
  .pipe(
    Effect.andThen(pouchDB(STAGING_BUILDS_COUCH_URL)),
    Effect.flatMap(db => Effect.promise(() => db.get(`medic:medic:${version}`, {attachments: true}))),
    Effect.map(({ _attachments }) => _attachments),
    Effect.filterOrFail(Predicate.isNotNullable),
  );

const decodeStagingDocAttachments = (attachments: Attachments) => pipe(
  CHT_DDOC_ATTACMENT_NAMES,
  Array.map(name => attachments[name] as FullAttachment),
  Array.map(DesignDocAttachment.decode),
  Effect.allWith({ concurrency: 'unbounded' }),
);

const preStageDdoc = (dbName: string) => (ddoc: CouchDesign) => Effect
  .logDebug(`Staging ddoc for ${dbName}/${ddoc._id}`).pipe(
    Effect.andThen({
      ...ddoc,
      _id: pipe(ddoc._id, String.replace(DDOC_PREFIX, STAGED_DDOC_PREFIX)),
      deploy_info: { user: 'Pre-staged by chtoolbox' }
    }),
    Effect.tap(saveDoc(dbName)),
    Effect.flatMap(({ _id }) => WarmViewsService.warmDesign(dbName, _id.replace(DDOC_PREFIX, ''))),
);

const preStageDdocs = (docsByDb: [DesignDocAttachment, string][]) => pipe(
  docsByDb,
  Array.map(([{ docs }, attachmentName]) => pipe(
    docs,
    Array.map(preStageDdoc(CHT_DATABASE_BY_ATTACHMENT_NAME[attachmentName])),
    Effect.all,
    Effect.map(Chunk.fromIterable),
    Effect.map(Stream.concatAll),
  ))
);

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
    upgrade: (version: string): UpgradeLogStreamEffect => assertReadyForUpgrade.pipe(
      Effect.andThen(upgradeCht(version)),
      Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)),
      Effect.provide(context),
    ),
    stage: (version: string): UpgradeLogStreamEffect => assertReadyForUpgrade.pipe(
      Effect.andThen(stageChtUpgrade(version)),
      Effect.andThen(streamUpgradeLogChanges(STAGING_COMPLETE_STATES)),
      Effect.provide(context),
    ),
    complete: (version: string): UpgradeLogStreamEffect => assertReadyForComplete.pipe(
      Effect.andThen(completeChtUpgrade(version)),
      Effect.andThen(streamUpgradeLogChanges(COMPLETED_STATES)
        .pipe(
          Effect.retry(Schedule.spaced(1000)), // Getting the upgrade log may fail while the server is still restarting
        )),
      Effect.provide(context),
    ),
    preStage: (version: string): Effect.Effect<CouchActiveTaskStream, Error> => assertReadyForUpgrade.pipe(
      Effect.andThen(CHT_DATABASES),
      Effect.map(Array.map(deleteStagedDdocs)),
      Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
      Effect.andThen(getStagingDocAttachments(version)),
      Effect.flatMap(decodeStagingDocAttachments),
      Effect.map(Array.zip(CHT_DDOC_ATTACMENT_NAMES)),
      Effect.map(preStageDdocs),
      Effect.flatMap(Effect.all),
      Effect.map(Chunk.fromIterable),
      Effect.map(Stream.concatAll),
      Effect.mapError(x => x as Error),
      Effect.provide(context),
    )
  }))),
  accessors: true,
}) {
}
