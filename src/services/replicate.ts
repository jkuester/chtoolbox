import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, saveDoc, streamChanges } from './pouchdb.ts';
import { Array, Match, Option, pipe, Redacted, Schema, Stream } from 'effect';
import { CHT_URL_AUTHENTICATED, CHT_USERNAME } from '../libs/config.js';
import { withPathname } from '../libs/url.js';

const SKIP_DDOC_SELECTOR = {
  _id: { '$regex': '^(?!_design/)' },
};

const getContactTypeSelector = (contactTypes: string[]) => Match
  .value(contactTypes)
  .pipe(
    Match.when(Array.isEmptyArray, () => ({})),
    Match.orElse(() => ({
      $or: [
        { type: { $in: contactTypes } },
        {
          $and: [
            { type: 'contact', },
            { contact_type: { $in: contactTypes } }
          ]
        }
      ]
    })),
  );

const hasContactTypes = (
  opts: ReplicationOptions
): opts is { contactTypes: [string, ...string[]] } => Array.isArray(opts.contactTypes)
  && Array.isNonEmptyArray(opts.contactTypes);

const getSelector = Effect.fn((opts: ReplicationOptions) => Match
  .value(opts)
  .pipe(
    Match.when(
      (opts) => !!opts.includeDdocs && hasContactTypes(opts),
      () => Effect.fail(new Error('Cannot replicate ddocs while also filtering by contact type.'))
    ),
    Match.when(({ includeDdocs }) => !!includeDdocs, () => Effect.succeed({})),
    Match.when(hasContactTypes, (opts) => Effect.succeed(getContactTypeSelector(opts.contactTypes))),
    Match.orElse(() => Effect.succeed(SKIP_DDOC_SELECTOR))
  ));

const getCouchDbUrl = (url: Redacted.Redacted<URL>, name: string) => pipe(
  name,
  Schema.decodeOption(Schema.URL),
  Option.getOrElse(() => pipe(
    Redacted.value(url),
    withPathname(name)
  )),
  url => url.toString()
);

const createReplicationDoc = Effect.fn((
  source: string,
  target: string,
  opts: ReplicationOptions
) => Effect
  .all([
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    CHT_URL_AUTHENTICATED,
    CHT_USERNAME,
    getSelector(opts),
  ])
  .pipe(Effect.map(([url, username, selector]) => ({
    user_ctx: {
      name: username,
      roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: getCouchDbUrl(url, source) },
    target: { url: getCouchDbUrl(url, target) },
    create_target: false,
    continuous: false,
    owner: username,
    selector,
  }))));

export class ReplicationDoc extends Schema.Class<ReplicationDoc>('ReplicationDoc')({
  _id: Schema.String,
  _replication_state: Schema.optional(Schema.String),
  _replication_stats: Schema.optional(Schema.Struct({
    docs_written: Schema.Number,
  })),
}) {
}

const streamReplicationDocChanges = Effect.fn((repDocId: string) => pipe(
  { include_docs: true, doc_ids: [repDocId], },
  streamChanges('_replicator'),
  Effect.map(Stream.map(({ doc }) => doc)),
  Effect.map(Stream.mapEffect(Schema.decodeUnknown(ReplicationDoc))),
  Effect.map(Stream.takeUntil(({ _replication_state }) => _replication_state === 'completed')),
));

const serviceContext = pipe(
  PouchDBService,
  Effect.map((pouch) => Context.make(PouchDBService, pouch))
);

interface ReplicationOptions {
  readonly includeDdocs?: boolean;
  readonly contactTypes?: string[];
}

export class ReplicateService extends Effect.Service<ReplicateService>()('chtoolbox/ReplicateService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    replicate: Effect.fn((
      source: string,
      target: string,
      opts: ReplicationOptions = {}
    ): Effect.Effect<Stream.Stream<ReplicationDoc, Error>, Error> => createReplicationDoc(source, target, opts)
      .pipe(
        Effect.flatMap(saveDoc('_replicator')),
        Effect.map(({ id }) => id),
        Effect.flatMap(streamReplicationDocChanges),
        Effect.mapError(x => x as Error),
        Effect.provide(context),
      )),
  }))),
  accessors: true,
}) {
}
