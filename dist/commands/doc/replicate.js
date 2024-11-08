"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicate = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const replicate_1 = require("../../services/replicate");
const active_tasks_1 = require("../../services/couch/active-tasks");
const core_1 = require("../../libs/core");
const isRepTask = (id) => (0, effect_1.pipe)(({ type }) => type === 'replication', effect_1.Predicate.and(({ doc_id }) => doc_id === id), effect_1.Predicate.and(({ docs_written }) => docs_written !== undefined));
const printReplicatingDocs = (id) => (tasks) => (0, effect_1.pipe)(tasks, effect_1.Array.findFirst(isRepTask(id)), effect_1.Option.map(({ docs_written }) => docs_written?.toString() ?? ''), effect_1.Option.map(docs_written => (0, core_1.clearThen)(effect_1.Console.log(`Replicating docs: ${docs_written}`))), effect_1.Option.getOrElse(() => effect_1.Effect.void), effect_1.Effect.tap(effect_1.Effect.logDebug('Printed replication doc task')));
const streamActiveTasks = (id) => active_tasks_1.CouchActiveTasksService
    .stream()
    .pipe(effect_1.Effect.map(effect_1.Stream.tap(printReplicatingDocs(id))), effect_1.Effect.flatMap(effect_1.Stream.runDrain));
const getReplicationDocId = (completionStream) => effect_1.Stream
    .take(completionStream, 1)
    .pipe(effect_1.Stream.runHead, effect_1.Effect.map(effect_1.Option.getOrThrow), effect_1.Effect.map(({ _id }) => _id));
const watchReplication = (completionStream) => effect_1.Stream
    .runDrain(completionStream)
    .pipe(effect_1.Effect.race(getReplicationDocId(completionStream)
    .pipe(effect_1.Effect.flatMap(streamActiveTasks))));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering replication, wait for job to complete.'), cli_1.Options.withDefault(false));
const all = cli_1.Options
    .boolean('all')
    .pipe(cli_1.Options.withDescription('Replicate everything including design documents'), cli_1.Options.withDefault(false));
const source = cli_1.Args
    .text({ name: 'source' })
    .pipe(cli_1.Args.withDescription('The source database name.'));
const target = cli_1.Args
    .text({ name: 'target' })
    .pipe(cli_1.Args.withDescription('The target database name.'));
exports.replicate = cli_1.Command
    .make('replicate', { follow, source, target, all }, ({ follow, source, target, all }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(replicate_1.ReplicateService.replicate(source, target, all)), effect_1.Effect.map(completionStream => effect_1.Option.liftPredicate(completionStream, () => follow)), effect_1.Effect.map(effect_1.Option.map(watchReplication)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.clear.pipe(effect_1.Effect.andThen(effect_1.Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks -f')))))))
    .pipe(cli_1.Command.withDescription('Triggers a one-time server-side replication of the docs from the source to the target database.'));
//# sourceMappingURL=replicate.js.map