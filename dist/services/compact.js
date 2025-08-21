import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Option, pipe, Stream, Function } from 'effect';
import { getDbNames } from "../libs/couch/dbs-info.js";
import { getDesignDocNames } from "../libs/couch/design-docs.js";
import { compactDb, compactDesign } from "../libs/couch/compact.js";
import { CouchActiveTask, filterStreamByType, getDbName, getDesignName, streamActiveTasks } from "../libs/couch/active-tasks.js";
import { mapErrorToGeneric, untilEmptyCount } from "../libs/core.js";
import { ChtClientService } from "./cht-client.js";
const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';
const compactDbViews = Effect.fn((dbName) => getDesignDocNames(dbName)
    .pipe(Effect.map(Array.map(compactCouchDesign(dbName))), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' }))));
const compactCouchDb = (compactDesigns) => Effect.fn((dbName) => pipe(Effect.suspend(() => compactDbViews(dbName)), Effect.when(() => compactDesigns), Effect.andThen(compactDb(dbName))));
const compactCouchDesign = (dbName) => (designName) => compactDesign(dbName, designName);
const compactAll = Effect.fn((compactDesigns) => getDbNames()
    .pipe(Effect.map(Array.map(compactCouchDb(compactDesigns))), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' }))));
const streamActiveTasksUntilEmpty = () => streamActiveTasks()
    .pipe(Stream.takeUntilEffect(untilEmptyCount(5)));
const getActiveTaskTypeFilter = (compactDesigns) => pipe([TYPE_DB_COMPACT, TYPE_VIEW_COMPACT], Option.liftPredicate(() => compactDesigns), Option.getOrElse(() => [TYPE_DB_COMPACT]), Function.tupled(filterStreamByType));
const streamAll = (compactDesigns) => streamActiveTasksUntilEmpty()
    .pipe(getActiveTaskTypeFilter(compactDesigns));
const hasDbName = (dbName) => (task) => getDbName(task) === dbName;
const streamDb = (dbName, compactDesigns) => pipe(streamAll(compactDesigns), Stream.map(Array.filter(hasDbName(dbName))));
const hasDesignName = (designName) => (task) => pipe(getDesignName(task), Option.map(name => name === designName), Option.getOrElse(() => false));
const streamDesign = (dbName, designName) => pipe(streamActiveTasksUntilEmpty(), filterStreamByType(TYPE_VIEW_COMPACT), Stream.map(Array.filter(hasDbName(dbName))), Stream.map(Array.filter(hasDesignName(designName))));
const serviceContext = ChtClientService.pipe(Effect.map(cht => Context.make(ChtClientService, cht)));
export class CompactService extends Effect.Service()('chtoolbox/CompactService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        compactAll: Effect.fn((compactDesigns) => pipe(compactAll(compactDesigns), Effect.andThen(streamAll(compactDesigns)), mapErrorToGeneric, Effect.provide(context))),
        compactDb: Effect.fn((dbName, compactDesigns) => pipe(dbName, compactCouchDb(compactDesigns), Effect.andThen(streamDb(dbName, compactDesigns)), mapErrorToGeneric, Effect.provide(context))),
        compactDesign: (dbName) => Effect.fn((designName) => pipe(designName, compactCouchDesign(dbName), Effect.andThen(streamDesign(dbName, designName)), mapErrorToGeneric, Effect.provide(context))),
    }))),
    accessors: true,
}) {
}
