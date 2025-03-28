import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { assertPouchResponse, PouchDBService, streamChanges } from './pouchdb.js';
import { EnvironmentService } from './environment.js';
import { Redacted, Schema, Stream, pipe, Option, Array, Match, String } from 'effect';
const SKIP_DDOC_SELECTOR = {
    _id: { '$regex': '^(?!_design/)' },
};
const getCouchDbUrl = (env) => (name) => pipe(name, Schema.decodeOption(Schema.URL), Option.map(url => url.toString()), Option.getOrElse(() => `${Redacted.value(env.url)}${name}`));
const noneStartWith = (prefix) => (values) => pipe(values, Array.findFirst(String.startsWith(prefix)), Option.map(() => false), Option.getOrElse(() => true));
const getSourceTargetUrls = (source, target) => EnvironmentService
    .get()
    .pipe(Effect.flatMap(env => pipe([source, target], Array.map(getCouchDbUrl(env)), Match.value, Match.when(noneStartWith(Redacted.value(env.url)), () => Effect.fail(new Error('Either source or target db must belong to the current CHT instance.'))), Match.orElse(urls => Effect.succeed(urls)))));
const createReplicationDoc = (sourceUrl, targetUrl, includeDdocs) => EnvironmentService
    .get()
    .pipe(Effect.map(env => ({
    user_ctx: {
        name: env.user,
        roles: ['_admin', '_reader', '_writer'],
    },
    source: { url: sourceUrl },
    target: { url: targetUrl },
    create_target: false,
    continuous: false,
    owner: env.user,
    selector: includeDdocs ? undefined : SKIP_DDOC_SELECTOR,
})));
export class ReplicationDoc extends Schema.Class('ReplicationDoc')({
    _id: Schema.String,
    _replication_state: Schema.optional(Schema.String),
    _replication_stats: Schema.optional(Schema.Struct({
        docs_written: Schema.Number,
    })),
}) {
}
const streamReplicationDocChanges = (repDocId) => PouchDBService
    .get('_replicator')
    .pipe(Effect.map(streamChanges({
    include_docs: true,
    doc_ids: [repDocId],
})), Effect.map(Stream.map(({ doc }) => doc)), Effect.map(Stream.mapEffect(Schema.decodeUnknown(ReplicationDoc))), Effect.map(Stream.takeUntil(({ _replication_state }) => _replication_state === 'completed')));
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
        replicate: (source, target, includeDdocs = false) => getSourceTargetUrls(source, target).pipe(Effect.flatMap(([sourceUrl, targetUrl]) => Effect.all([
            PouchDBService.get('_replicator'),
            createReplicationDoc(sourceUrl, targetUrl, includeDdocs)
        ])), Effect.flatMap(([db, doc]) => Effect.promise(() => db.bulkDocs([doc]))), Effect.map(([resp]) => resp), Effect.map(assertPouchResponse), Effect.map(({ id }) => id), Effect.flatMap(streamReplicationDocChanges), Effect.provide(context))
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=replicate.js.map