"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeTasks = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const active_tasks_1 = require("../services/couch/active-tasks");
const getDesignDisplayName = (task) => (0, active_tasks_1.getDesignName)(task)
    .pipe(effect_1.Option.map(design => `/${design}`), effect_1.Option.getOrElse(() => effect_1.String.empty));
const getTaskDisplayData = (task) => ({
    type: task.type,
    database: `${(0, active_tasks_1.getDbName)(task)}${getDesignDisplayName(task)}`,
    pid: (0, active_tasks_1.getPid)(task),
    progress: (0, active_tasks_1.getProgressPct)(task),
    started_at: effect_1.DateTime
        .unsafeMake(effect_1.Number.multiply(task.started_on, 1000))
        .pipe(effect_1.DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })),
});
const getPrintableTasks = (tasks) => (0, effect_1.pipe)(tasks, effect_1.Option.liftPredicate(effect_1.Array.isNonEmptyArray), effect_1.Option.map(effect_1.Array.map(getTaskDisplayData)), effect_1.Option.map(active_tasks_1.getDisplayDictByPid), effect_1.Option.getOrElse(() => 'No active tasks.'));
const printCurrentTasks = active_tasks_1.CouchActiveTasksService.pipe(effect_1.Effect.flatMap(service => service.get()), effect_1.Effect.map(getPrintableTasks), effect_1.Effect.tap(effect_1.Console.table));
const followActiveTasks = active_tasks_1.CouchActiveTasksService.pipe(effect_1.Effect.map(svc => svc.stream()), effect_1.Effect.flatMap(effect_1.Stream.runForEach(tasks => effect_1.Effect
    .succeed(getPrintableTasks(tasks))
    .pipe(effect_1.Effect.tap(effect_1.Console.clear), effect_1.Effect.tap(effect_1.Console.table)))));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('Continuously poll the active tasks.'), cli_1.Options.withDefault(false));
exports.activeTasks = cli_1.Command
    .make('active-tasks', { follow }, ({ follow }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(followActiveTasks), effect_1.Option.liftPredicate(() => follow), effect_1.Option.getOrElse(() => printCurrentTasks)))
    .pipe(cli_1.Command.withDescription(`Force compaction on databases and views.`));
//# sourceMappingURL=active-tasks.js.map