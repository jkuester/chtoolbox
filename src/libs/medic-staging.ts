import * as Effect from 'effect/Effect';
import { pouchDB } from './shim.ts';
import { Array, Either, Encoding, pipe, Predicate, Schema, ParseResult } from 'effect';
import { CouchDesign } from './couch/design.ts';

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
