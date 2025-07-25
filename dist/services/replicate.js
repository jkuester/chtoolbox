import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { PouchDBService, saveDoc, streamChanges } from './pouchdb.js';
import { EnvironmentService } from './environment.js';
import { Array, Match, Option, pipe, Redacted, Schema, Stream } from 'effect';
const SKIP_DDOC_SELECTOR = {
    _id: { '$regex': '^(?!_design/)' },
};
const getContactTypeSelector = (contactTypes) => Match
    .value(contactTypes)
    .pipe(Match.when(Array.isEmptyArray, () => ({})), Match.orElse(() => ({
    $or: [
        { type: { $in: contactTypes } },
        { $and: [
                { type: 'contact', },
                { contact_type: { $in: contactTypes } }
            ] }
    ]
})));
const hasContactTypes = (opts) => Array.isArray(opts.contactTypes)
    && Array.isNonEmptyArray(opts.contactTypes);
const getSelector = (opts) => Match
    .value(opts)
    .pipe(Match.when((opts) => !!opts.includeDdocs && hasContactTypes(opts), () => Effect.fail(new Error('Cannot replicate ddocs while also filtering by contact type.'))), Match.when(({ includeDdocs }) => !!includeDdocs, () => Effect.succeed({})), Match.when(hasContactTypes, (opts) => Effect.succeed(getContactTypeSelector(opts.contactTypes))), Match.orElse(() => Effect.succeed(SKIP_DDOC_SELECTOR)));
const getCouchDbUrl = (env, name) => pipe(name, Schema.decodeOption(Schema.URL), Option.map(url => url.toString()), Option.getOrElse(() => `${Redacted.value(env.url)}${name}`));
const createReplicationDoc = (source, target, opts) => Effect
    .all([
    EnvironmentService.get(),
    getSelector(opts),
])
    .pipe(Effect.map(([env, selector]) => ({
    user_ctx: {
        name: env.user,
        roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: getCouchDbUrl(env, source) },
    target: { url: getCouchDbUrl(env, target) },
    create_target: false,
    continuous: false,
    owner: env.user,
    selector,
})));
export class ReplicationDoc extends Schema.Class('ReplicationDoc')({
    _id: Schema.String,
    _replication_state: Schema.optional(Schema.String),
    _replication_stats: Schema.optional(Schema.Struct({
        docs_written: Schema.Number,
    })),
}) {
}
const streamReplicationDocChanges = (repDocId) => pipe({ include_docs: true, doc_ids: [repDocId], }, streamChanges('_replicator'), Effect.map(Stream.map(({ doc }) => doc)), Effect.map(Stream.mapEffect(Schema.decodeUnknown(ReplicationDoc))), Effect.map(Stream.takeUntil(({ _replication_state }) => _replication_state === 'completed')));
const serviceContext = Effect
    .all([
    EnvironmentService,
    PouchDBService,
])
    .pipe(Effect.map(([env, pouch,]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(EnvironmentService, env))));
export class ReplicateService extends Effect.Service()('chtoolbox/ReplicateService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        replicate: (source, target, opts = {}) => createReplicationDoc(source, target, opts)
            .pipe(Effect.flatMap(saveDoc('_replicator')), Effect.map(({ id }) => id), Effect.flatMap(streamReplicationDocChanges), Effect.mapError(x => x), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=replicate.js.map