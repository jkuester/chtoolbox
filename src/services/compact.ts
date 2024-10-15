import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Option, pipe, Stream } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
import { CouchActiveTasksService, filterStreamByType, getDbName, getDesignName } from './couch/active-tasks';
import { untilEmptyCount } from '../libs/core';

const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';

const dbNames = CouchDbsInfoService.pipe(
  Effect.flatMap(infoService => infoService.getDbNames()),
);

const getDesignDocNames = (dbName: string) => CouchDesignDocsService.pipe(
  Effect.flatMap(designDocsService => designDocsService.getNames(dbName)),
);

const compactDb = (dbName: string) => CouchCompactService.pipe(
  Effect.flatMap(compactService => compactService.compactDb(dbName)),
);

const compactDesign = (dbName: string) => (designName: string) => CouchCompactService.pipe(
  Effect.flatMap(compactService => compactService.compactDesign(dbName, designName)),
);

const compactAll = dbNames.pipe(
  Effect.tap(names => pipe(
    names,
    Array.map(compactDb),
    Effect.all,
  )),
  Effect.map(Array.map(dbName => getDesignDocNames(dbName)
    .pipe(
      Effect.map(Array.map(compactDesign(dbName))),
      Effect.flatMap(Effect.all),
    ))),
  Effect.flatMap(Effect.all),
  Effect.andThen(Effect.void),
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

const streamAll = () => streamActiveTasks()
  .pipe(Effect.map(filterStreamByType(TYPE_DB_COMPACT, TYPE_VIEW_COMPACT)));

const streamDb = (dbName: string) => streamActiveTasks()
  .pipe(
    Effect.map(filterStreamByType(TYPE_DB_COMPACT)),
    Effect.map(Stream.map(Array.filter(task => getDbName(task) === dbName))),
  );

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
    compactAll: () => compactAll.pipe(
      Effect.andThen(streamAll()),
      Effect.provide(context)
    ),
    compactDb: (dbName: string) => compactDb(dbName)
      .pipe(
        Effect.andThen(streamDb(dbName)),
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
