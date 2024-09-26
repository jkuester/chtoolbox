"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeTasks = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const active_tasks_1 = require("../services/couch/active-tasks");
const getDbNameFromShard = (shard) => shard.split('/')[2].split('.')[0];
const getDesignName = (design_document) => effect_1.Option
    .fromNullable(design_document)
    .pipe(effect_1.Option.map(d => `/${d.split('/')[1]}`), effect_1.Option.getOrElse(() => ''));
const getTaskDisplayData = ({ type, database, design_document, pid, progress, started_on, }) => ({
    type,
    database: `${getDbNameFromShard(database)}${getDesignName(design_document)}`,
    pid: pid.substring(1, pid.length - 1),
    progress: `${progress.toString()}%`,
    started_at: effect_1.DateTime
        .unsafeMake(effect_1.Number.multiply(started_on, 1000))
        .pipe(effect_1.DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
});
const getTasksDisplayData = (tasks) => (0, effect_1.pipe)(effect_1.Array.map(tasks, getTaskDisplayData), effect_1.Array.reduce({}, (data, task) => effect_1.Record.set(task.pid, effect_1.Record.remove('pid')(task))(data)));
const couchActiveTasks = effect_1.Effect.flatMap(active_tasks_1.CouchActiveTasksService, service => service.get());
const orderByStartedOn = effect_1.Order.make((a, b) => effect_1.Number.Order(a.started_on, b.started_on));
const printActiveTasks = couchActiveTasks.pipe(effect_1.Effect.map(effect_1.Array.sort(orderByStartedOn)), effect_1.Effect.map(getTasksDisplayData), effect_1.Effect.tap(effect_1.Console.table));
const followActiveTasks = effect_1.Effect.repeat(effect_1.Console.clear.pipe(effect_1.Effect.andThen(printActiveTasks), effect_1.Effect.delay(5000)), { until: () => false });
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('Continuously poll the active tasks.'), cli_1.Options.withDefault(false));
exports.activeTasks = cli_1.Command
    .make('active-tasks', { follow }, ({ follow }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(followActiveTasks), effect_1.Option.liftPredicate(() => follow), effect_1.Option.getOrElse(() => printActiveTasks)))
    .pipe(cli_1.Command.withDescription(`Force compaction on databases and views.`));
//# sourceMappingURL=active-tasks.js.map