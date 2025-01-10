"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compact = exports.streamActiveTasks = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const compact_1 = require("../../services/compact");
const core_1 = require("../../libs/core");
const active_tasks_1 = require("../../libs/couch/active-tasks");
const getDesignDisplayName = (task) => (0, active_tasks_1.getDesignName)(task)
    .pipe(effect_1.Option.map(design => `/${design}`), effect_1.Option.getOrElse(() => effect_1.String.empty));
const getTaskDisplayData = (task) => ({
    database: `${(0, active_tasks_1.getDbName)(task)}${getDesignDisplayName(task)}`,
    pid: (0, active_tasks_1.getPid)(task),
    progress: (0, active_tasks_1.getProgressPct)(task),
});
const streamActiveTasks = (taskStream) => taskStream.pipe(effect_1.Stream.map(effect_1.Array.map(getTaskDisplayData)), effect_1.Stream.map(active_tasks_1.getDisplayDictByPid), effect_1.Stream.runForEach(taskDict => effect_1.Console.clear.pipe(effect_1.Effect.tap(effect_1.Console.log('Currently compacting:')), effect_1.Effect.tap(effect_1.Console.table(taskDict)))), effect_1.Effect.tap(effect_1.Console.clear.pipe(effect_1.Effect.tap(effect_1.Console.log('Compaction complete.')))));
exports.streamActiveTasks = streamActiveTasks;
const compactAll = (compactDesigns) => compact_1.CompactService
    .compactAll(compactDesigns)
    .pipe(effect_1.Effect.map(effect_1.Array.make));
const doCompaction = (databases, all) => (0, effect_1.pipe)(databases, effect_1.Option.liftPredicate(effect_1.Array.isNonEmptyArray), effect_1.Option.map(effect_1.Array.map(dbName => compact_1.CompactService.compactDb(dbName, all))), effect_1.Option.map(effect_1.Effect.all), effect_1.Option.getOrElse(() => compactAll(all)), x => x);
const databases = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database(s) to compact. Leave empty to compact all databases.'), cli_1.Args.atLeast(0));
const all = cli_1.Options
    .boolean('all')
    .pipe(cli_1.Options.withAlias('a'), cli_1.Options.withDescription('Also compact all of the designs for the database(s).'), cli_1.Options.withDefault(false));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'), cli_1.Options.withDefault(false));
exports.compact = cli_1.Command
    .make('compact', { follow, databases, all }, ({ follow, databases, all }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(() => doCompaction(databases, all)), effect_1.Effect.map(effect_1.Option.liftPredicate(() => follow)), effect_1.Effect.map(effect_1.Option.map(core_1.mergeArrayStreams)), effect_1.Effect.map(effect_1.Option.map(exports.streamActiveTasks)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.log('Compaction started. Watch the active tasks for progress: chtx active-tasks -f')))))
    .pipe(cli_1.Command.withDescription(`Run compaction on one or more Couch databases. `
    + `The \`design compact\` command can be used to compact individual designs.`));
//# sourceMappingURL=compact.js.map