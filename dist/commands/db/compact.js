import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe, Stream, String } from 'effect';
import { initializeUrl } from "../../index.js";
import { CompactService } from "../../services/compact.js";
import { mergeArrayStreams } from "../../libs/core.js";
import { CouchActiveTask, getDbName, getDesignName, getDisplayDictByPid, getPid, getProgressPct } from "../../libs/couch/active-tasks.js";
import { ChtClientService } from "../../services/cht-client.js";
import { clearConsole } from "../../libs/console.js";
const getDesignDisplayName = (task) => getDesignName(task)
    .pipe(Option.map(design => `/${design}`), Option.getOrElse(() => String.empty));
export const getTaskDisplayData = (task) => ({
    database: `${getDbName(task)}${getDesignDisplayName(task)}`,
    pid: getPid(task),
    progress: getProgressPct(task),
});
export const streamActiveTasks = (taskStream) => taskStream.pipe(Stream.map(Array.map(getTaskDisplayData)), Stream.map(getDisplayDictByPid), Stream.runForEach(taskDict => clearConsole.pipe(Effect.tap(Console.log('Currently compacting:')), Effect.tap(Console.table(taskDict)))), Effect.tap(clearConsole.pipe(Effect.tap(Console.log('Compaction complete.')))));
const compactAll = (compactDesigns) => CompactService
    .compactAll(compactDesigns)
    .pipe(Effect.map(Array.make));
const doCompaction = (databases, all) => pipe(databases, Option.liftPredicate(Array.isNonEmptyArray), Option.map(Array.map(dbName => CompactService.compactDb(dbName, all))), Option.map(Effect.allWith({ concurrency: 'unbounded' })), Option.getOrElse(() => compactAll(all)));
const databases = Args
    .text({ name: 'database' })
    .pipe(Args.withDescription('The database(s) to compact. Leave empty to compact all databases.'), Args.atLeast(0));
const all = Options
    .boolean('all')
    .pipe(Options.withAlias('a'), Options.withDescription('Also compact all of the designs for the database(s).'));
const follow = Options
    .boolean('follow')
    .pipe(Options.withAlias('f'), Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'));
export const compact = Command
    .make('compact', { follow, databases, all }, ({ follow, databases, all }) => initializeUrl.pipe(Effect.andThen(() => doCompaction(databases, all)), Effect.map(Option.liftPredicate(() => follow)), Effect.map(Option.map(mergeArrayStreams)), Effect.map(Option.map(streamActiveTasks)), Effect.flatMap(Option.getOrElse(() => Console.log('Compaction started. Watch the active tasks for progress: chtx active-tasks -f')))))
    .pipe(Command.withDescription(`Run compaction on one or more Couch databases. `
    + `The \`design compact\` command can be used to compact individual designs.`));
