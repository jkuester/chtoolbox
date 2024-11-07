import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Match, Option, pipe, Stream } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
import { CouchActiveTasksService, filterStreamByType, getDbName, getDesignName } from './couch/active-tasks';
import { untilEmptyCount } from '../libs/core';

const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';

const compactDbViews = (dbName: string) => CouchDesignDocsService
  .getNames(dbName)
  .pipe(
    Effect.map(Array.map(compactDesign(dbName))),
    Effect.flatMap(Effect.all),
  );

const compactDb = (dbName: string, compactDesigns: boolean) => CouchCompactService
  .compactDb(dbName)
  .pipe(
    Effect.andThen(Match
      .value(compactDesigns)
      .pipe(
        Match.when(true, () => compactDbViews(dbName)),
        Match.orElse(() => Effect.void),
      )),
  );

const compactDesign = (dbName: string) => (designName: string) => CouchCompactService.compactDesign(dbName, designName);

const compactAll = (compactDesigns: boolean) => CouchDbsInfoService
  .getDbNames()
  .pipe(
    Effect.map(Array.map(dbName => compactDb(dbName, compactDesigns))),
    Effect.flatMap(Effect.all),
  );

const ServiceContext = Effect
  .all([
    CouchActiveTasksService,
    CouchDbsInfoService,
    CouchDesignDocsService,
    CouchCompactService,
    CouchDesignInfoService,
  ])
  .pipe(Effect.map(([
    activeTasks,
    dbsInfo,
    designDocs,
    compact,
    designInfo
  ]) => Context
    .make(CouchDbsInfoService, dbsInfo)
    .pipe(
      Context.add(CouchActiveTasksService, activeTasks),
      Context.add(CouchDesignDocsService, designDocs),
      Context.add(CouchCompactService, compact),
      Context.add(CouchDesignInfoService, designInfo),
    )));

const streamActiveTasks = () => CouchActiveTasksService.pipe(
  Effect.map(service => service.stream()),
  Effect.map(Stream.takeUntilEffect(untilEmptyCount(5))),
);

const getActiveTaskTypeFilter = (compactDesigns: boolean) => pipe(
  [TYPE_DB_COMPACT, TYPE_VIEW_COMPACT],
  Option.liftPredicate(() => compactDesigns),
  Option.getOrElse(() => [TYPE_DB_COMPACT]),
  types => filterStreamByType(...types),
);

const streamAll = (compactDesigns: boolean) => streamActiveTasks()
  .pipe(Effect.map(getActiveTaskTypeFilter(compactDesigns)));

const streamDb = (dbName: string, compactDesigns: boolean) => streamAll(compactDesigns)
  .pipe(Effect.map(Stream.map(Array.filter(task => getDbName(task) === dbName))));


const streamDesign = (dbName: string, designName: string) => streamActiveTasks()
  .pipe(
    Effect.map(filterStreamByType(TYPE_VIEW_COMPACT)),
    Effect.map(Stream.map(Array.filter(task => getDbName(task) === dbName))),
    Effect.map(Stream.map(Array.filter(task => getDesignName(task)
      .pipe(
        Option.map(name => name === designName),
        Option.getOrElse(() => false),
      )))),
  );

export class CompactService extends Effect.Service<CompactService>()('chtoolbox/CompactService', {
  effect: ServiceContext.pipe(Effect.map(context => ({
    compactAll: (compactDesigns: boolean) => compactAll(compactDesigns)
      .pipe(
        Effect.andThen(streamAll(compactDesigns)),
        Effect.provide(context),
      ),
    compactDb: (dbName: string, compactDesigns: boolean) => compactDb(dbName, compactDesigns)
      .pipe(
        Effect.andThen(streamDb(dbName, compactDesigns)),
        Effect.provide(context),
      ),
    compactDesign: (dbName: string) => (designName: string) => compactDesign(dbName)(designName)
      .pipe(
        Effect.andThen(streamDesign(dbName, designName)),
        Effect.provide(context),
      ),
  }))),
  accessors: true,
}) {
}
