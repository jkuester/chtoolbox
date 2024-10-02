"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicate = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const replicate_1 = require("../../services/replicate");
const active_tasks_1 = require("../../services/couch/active-tasks");
const logReplicationMessage = effect_1.Console.clear.pipe(effect_1.Effect.andThen(effect_1.Console.log(`Replicating...`)));
const isRepTask = (id) => (task) => task.type === 'replication'
    && task.doc_id === id
    && task.docs_written !== undefined;
const printActiveTasks = (id) => active_tasks_1.CouchActiveTasksService.pipe(effect_1.Effect.flatMap(service => service.get()), effect_1.Effect.map(effect_1.Array.findFirst(isRepTask(id))), effect_1.Effect.map(effect_1.Option.map(task => logReplicationMessage
    .pipe(effect_1.Effect.andThen(effect_1.Console.log(`Replicating docs: ${task.docs_written.toString()}`))))), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Effect.void)));
const pollActiveTasks = (id) => effect_1.Effect.repeat(printActiveTasks(id), effect_1.Schedule.spaced(1000));
const waitForCompletedRep = (changesFeed) => effect_1.Effect.async((callBack) => void changesFeed
    .on('error', err => callBack(effect_1.Console.log(`Replication failed: ${JSON.stringify(err)}`)))
    .on('complete', resp => callBack(effect_1.Console.log(`Could not follow replication doc changes feed: ${JSON.stringify(resp)}`)))
    .on('change', ({ doc }) => effect_1.Option
    .fromNullable(doc)
    .pipe(effect_1.Option.flatMap(effect_1.Option.liftPredicate(doc => doc._replication_state === 'completed')), effect_1.Option.map(() => callBack(effect_1.Console.clear.pipe(effect_1.Effect.tap(effect_1.Console.log('Replication complete'))))), effect_1.Option.getOrElse(() => callBack(effect_1.Console.log(`Replication failed: ${JSON.stringify(doc)}`))))));
const watchReplication = ({ id }) => replicate_1.ReplicateService.pipe(effect_1.Effect.flatMap(service => service.watch(id)), effect_1.Effect.map(waitForCompletedRep), effect_1.Effect.tap(wait => effect_1.Effect
    .fork(pollActiveTasks(id))
    .pipe(effect_1.Effect.flatMap(fiber => wait.pipe(effect_1.Effect.andThen(effect_1.Fiber.interrupt(fiber)))))));
const replicateAsync = (source, target) => replicate_1.ReplicateService.pipe(effect_1.Effect.flatMap(service => service.replicate(source, target)));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering replication, wait for job to complete.'), cli_1.Options.withDefault(false));
const source = cli_1.Args
    .text({ name: 'source' })
    .pipe(cli_1.Args.withDescription('The source database name.'));
const target = cli_1.Args
    .text({ name: 'target' })
    .pipe(cli_1.Args.withDescription('The target database name.'));
exports.replicate = cli_1.Command
    .make('replicate', { follow, source, target }, ({ follow, source, target }) => index_1.initializeUrl.pipe(effect_1.Effect.tap(logReplicationMessage), effect_1.Effect.andThen(replicateAsync(source, target)), effect_1.Effect.map(resp => effect_1.Option.liftPredicate(resp, () => follow)), effect_1.Effect.map(effect_1.Option.map(watchReplication)), effect_1.Effect.tap(effect_1.Option.getOrElse(() => effect_1.Console.clear.pipe(effect_1.Effect.andThen(effect_1.Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks')))))))
    .pipe(cli_1.Command.withDescription(`Triggers a one-time replication from the source to the target database.`));
//# sourceMappingURL=replicate.js.map