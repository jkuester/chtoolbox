import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Match, Option, pipe, Stream } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info.js';
import { getDesignDocNames } from '../libs/couch/design-docs.js';
import { compactDb, compactDesign } from '../libs/couch/compact.js';
import { filterStreamByType, getDbName, getDesignName, streamActiveTasks } from '../libs/couch/active-tasks.js';
import { untilEmptyCount } from '../libs/core.js';
import { ChtClientService } from './cht-client.js';
const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';
const compactDbViews = (dbName) => getDesignDocNames(dbName)
    .pipe(Effect.map(Array.map(compactCouchDesign(dbName))), Effect.flatMap(Effect.all));
const compactCouchDb = (dbName, compactDesigns) => compactDb(dbName)
    .pipe(Effect.andThen(Match
    .value(compactDesigns)
    .pipe(Match.when(true, () => compactDbViews(dbName)), Match.orElse(() => Effect.void))));
const compactCouchDesign = (dbName) => (designName) => compactDesign(dbName, designName);
const compactAll = (compactDesigns) => getDbNames()
    .pipe(Effect.map(Array.map(dbName => compactCouchDb(dbName, compactDesigns))), Effect.flatMap(Effect.all));
const streamActiveTasksUntilEmpty = () => streamActiveTasks()
    .pipe(Stream.takeUntilEffect(untilEmptyCount(5)));
const getActiveTaskTypeFilter = (compactDesigns) => pipe([TYPE_DB_COMPACT, TYPE_VIEW_COMPACT], Option.liftPredicate(() => compactDesigns), Option.getOrElse(() => [TYPE_DB_COMPACT]), types => filterStreamByType(...types));
const streamAll = (compactDesigns) => streamActiveTasksUntilEmpty()
    .pipe(getActiveTaskTypeFilter(compactDesigns));
const streamDb = (dbName, compactDesigns) => streamAll(compactDesigns)
    .pipe(Stream.map(Array.filter(task => getDbName(task) === dbName)));
const streamDesign = (dbName, designName) => streamActiveTasksUntilEmpty()
    .pipe(filterStreamByType(TYPE_VIEW_COMPACT), Stream.map(Array.filter(task => getDbName(task) === dbName)), Stream.map(Array.filter(task => getDesignName(task)
    .pipe(Option.map(name => name === designName), Option.getOrElse(() => false)))));
const serviceContext = ChtClientService.pipe(Effect.map(cht => Context.make(ChtClientService, cht)));
export class CompactService extends Effect.Service()('chtoolbox/CompactService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        compactAll: (compactDesigns) => compactAll(compactDesigns)
            .pipe(Effect.andThen(streamAll(compactDesigns)), Effect.provide(context)),
        compactDb: (dbName, compactDesigns) => compactCouchDb(dbName, compactDesigns)
            .pipe(Effect.andThen(streamDb(dbName, compactDesigns)), Effect.provide(context)),
        compactDesign: (dbName) => (designName) => compactCouchDesign(dbName)(designName)
            .pipe(Effect.andThen(streamDesign(dbName, designName)), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=compact.js.map