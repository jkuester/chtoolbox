import * as Effect from 'effect/Effect';
import { pouchDB } from './shim.ts';
import { Array, Either, Encoding, Option, ParseResult, pipe, Predicate, Record, Schema, Tuple, Function } from 'effect';
import { CouchDesign, getCouchDesign } from './couch/design.ts';
import { getAllDocs } from '../services/pouchdb.ts';
import { isDeepStrictEqual } from 'node:util';

type Attachments = PouchDB.Core.Attachments;
type FullAttachment = PouchDB.Core.FullAttachment;

const STAGING_BUILDS_COUCH_URL = 'https://staging.dev.medicmobile.org/_couch/builds_4';
const CHT_DATABASES = [
  'medic',
  'medic-sentinel',
  'medic-logs',
  'medic-users-meta',
  '_users'
] as const;
export const CHT_DDOC_ATTACHMENT_NAMES = [
  'ddocs/medic.json',
  'ddocs/sentinel.json',
  'ddocs/logs.json',
  'ddocs/users-meta.json',
  'ddocs/users.json'
] as const;
export const CHT_DATABASE_BY_ATTACHMENT_NAME: Record<
  typeof CHT_DDOC_ATTACHMENT_NAMES[number],
  typeof CHT_DATABASES[number]
> = pipe(
  CHT_DDOC_ATTACHMENT_NAMES,
  Array.zip(CHT_DATABASES),
  Record.fromEntries,
);

export class DesignDocAttachment extends Schema.Class<DesignDocAttachment>('DesignDocAttachment')({
  docs: Schema.Array(CouchDesign),
}) {
  static readonly decode = (
    attachment: FullAttachment
  ): Effect.Effect<DesignDocAttachment, ParseResult.ParseError> => pipe(
    attachment.data as string,
    Encoding.decodeBase64String,
    Either.getOrThrow,
    JSON.parse,
    Schema.decodeUnknown(DesignDocAttachment),
  );
}

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

export const getDesignDocAttachments = Effect.fn((version: string) => pipe(
  getStagingDocAttachments(version),
  Effect.flatMap(decodeStagingDocAttachments),
  Effect.map(Array.zip(CHT_DDOC_ATTACHMENT_NAMES))
));

type ChtDdocsByDb = Record<typeof CHT_DATABASES[number], readonly CouchDesign[]>;

export interface ChtDdocDiff {
  created: readonly CouchDesign[],
  deleted: readonly CouchDesign[],
  updated: readonly CouchDesign[]
}

export type ChtDdocsDiffByDb = Record<typeof CHT_DATABASES[number], ChtDdocDiff>;

const createDdocsRecord = (
  record: ChtDdocsByDb,
  [ddocs, dbName]: [readonly CouchDesign[], typeof CHT_DATABASES[number]]
) => ({ ...record, [dbName]: ddocs });

const getStagingDesignDocsByDb = Effect.fn((version: string) => pipe(
  getDesignDocAttachments(version),
  Effect.map(Array.map(Tuple.mapFirst(({ docs }) => docs))),
  Effect.map(Array.map(Tuple.mapSecond(attachName => CHT_DATABASE_BY_ATTACHMENT_NAME[attachName]))),
  Effect.map(Array.reduce({} as ChtDdocsByDb, createDdocsRecord))
));

const currentChtBaseVersionEffect = Effect.suspend(() => pipe(
  getCouchDesign('medic', 'medic'),
  Effect.map(({ build_info }) => build_info?.base_version),
  Effect.filterOrFail(Predicate.isNotUndefined)
));

const getCurrentCouchDesigns = ([dbName, keys]: [typeof CHT_DATABASES[number], string[]]) => pipe(
  { keys },
  getAllDocs(dbName),
  Effect.map(Array.map(doc => Schema.decodeUnknownSync(CouchDesign)(doc))),
  Effect.map(ddocs => Tuple.make(ddocs, dbName))
);

const currentDesignDocsByDbEffect = pipe(
  currentChtBaseVersionEffect,
  Effect.flatMap(getStagingDesignDocsByDb),
  Effect.map(Record.toEntries),
  Effect.map(Array.map(Tuple.mapSecond(Array.map(({ _id }) => _id)))),
  Effect.map(Array.map(getCurrentCouchDesigns)),
  Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
  Effect.map(Array.reduce({} as ChtDdocsByDb, createDdocsRecord)),
);

const getDdocWithId = (ddocs: readonly CouchDesign[]) => (ddoc: CouchDesign) => pipe(
  ddocs,
  Array.findFirst(({ _id }) => ddoc._id === _id),
);
const hasDdocWithId = (ddocs: readonly CouchDesign[]) => (ddoc: CouchDesign) => pipe(
  ddoc,
  getDdocWithId(ddocs),
  Option.isSome
);
const getCreatedDdocs = (current: readonly CouchDesign[], target: readonly CouchDesign[]) => pipe(
  target,
  Array.filter(Predicate.not(hasDdocWithId(current))),
);
const getDeletedDdocs = (current: readonly CouchDesign[], target: readonly CouchDesign[]) => pipe(
  current,
  Array.filter(Predicate.not(hasDdocWithId(target))),
);

const isDdocUpdated = (ddocs: [CouchDesign, CouchDesign]) => pipe(
  ddocs,
  Tuple.map(({ views, nouveau }) => ({ views, nouveau })),
  Predicate.not(Function.tupled(isDeepStrictEqual))
);
const getUpdatedDdocs = (current: readonly CouchDesign[], target: readonly CouchDesign[]) => pipe(
  current,
  Array.map(getDdocWithId(target)),
  Array.zip(current),
  Array.map(Tuple.swap),
  Array.filterMap(([currentDdoc, targetDdocOpt]) => pipe(
    targetDdocOpt,
    Option.map(targetDdoc => Tuple.make(currentDdoc, targetDdoc))
  )),
  Array.filter(isDdocUpdated),
  Array.unzip,
  Tuple.getSecond
);

const getDdocDiff = (current: readonly CouchDesign[], target: readonly CouchDesign[]): ChtDdocDiff => ({
  created: getCreatedDdocs(current, target),
  deleted: getDeletedDdocs(current, target),
  updated: getUpdatedDdocs(current, target)
});

const getDdocDiffsByDb = (
  [current, target]: [ChtDdocsByDb, ChtDdocsByDb]
): ChtDdocsDiffByDb => pipe(
  CHT_DATABASES,
  Array.map(db => getDdocDiff(current[db], target[db])),
  Array.zip(CHT_DATABASES),
  Array.map(Tuple.swap),
  Record.fromEntries,
  diff => diff as ChtDdocsDiffByDb
);

export const getDesignDocsDiffWithCurrent = Effect.fn((version: string) => pipe(
  Effect.all([
    currentDesignDocsByDbEffect,
    getStagingDesignDocsByDb(version)
  ], { concurrency: 'unbounded' }),
  Effect.map(getDdocDiffsByDb)
));

export const getDesignDocsDiff = Effect.fn((
  baseVersion: string,
  targetVersion: string
) => pipe(
  Effect.all([
    getStagingDesignDocsByDb(baseVersion),
    getStagingDesignDocsByDb(targetVersion)
  ], { concurrency: 'unbounded' }),
  Effect.map(getDdocDiffsByDb)
));
