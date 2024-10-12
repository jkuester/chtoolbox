"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compact = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const compact_1 = require("../services/compact");
const active_tasks_1 = require("../services/couch/active-tasks");
const getDesignDisplayName = (task) => (0, active_tasks_1.getDesignName)(task)
    .pipe(effect_1.Option.map(design => `/${design}`), effect_1.Option.getOrElse(() => effect_1.String.empty));
const getTaskDisplayData = (task) => ({
    database: `${(0, active_tasks_1.getDbName)(task)}${getDesignDisplayName(task)}`,
    pid: (0, active_tasks_1.getPid)(task),
    progress: (0, active_tasks_1.getProgressPct)(task),
});
const streamActiveTasks = (taskStream) => taskStream.pipe(effect_1.Stream.map(effect_1.Array.map(getTaskDisplayData)), effect_1.Stream.map(active_tasks_1.getDisplayDictByPid), effect_1.Stream.runForEach(taskDict => effect_1.Console.clear.pipe(effect_1.Effect.tap(effect_1.Console.log('Currently compacting:')), effect_1.Effect.tap(effect_1.Console.table(taskDict)))), effect_1.Effect.tap(effect_1.Console.clear.pipe(effect_1.Effect.tap(effect_1.Console.log('Compaction complete.')))));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'), cli_1.Options.withDefault(false));
exports.compact = cli_1.Command
    .make('compact', { follow }, ({ follow }) => index_1.initializeUrl.pipe(effect_1.Effect.tap(effect_1.Console.log('Compacting all dbs and views...')), effect_1.Effect.andThen(compact_1.CompactService), effect_1.Effect.flatMap(compactService => compactService.compactAll()), effect_1.Effect.map(effect_1.Option.liftPredicate(() => follow)), effect_1.Effect.map(effect_1.Option.map(streamActiveTasks)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.log('Compaction started. Watch the active tasks for progress: chtx active-tasks')))))
    .pipe(cli_1.Command.withDescription(`Force compaction on databases and views.`));
//# sourceMappingURL=compact.js.map