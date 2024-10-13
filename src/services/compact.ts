import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array, Option, pipe, Stream } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
import {
  CouchActiveTask,
  CouchActiveTasksService,
  filterStreamByType,
  getDbName,
  getDesignName
} from './couch/active-tasks';
import { untilEmptyCount } from '../libs/core';

const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';

export interface CompactService {
  readonly compactAll: () => Effect.Effect<Stream.Stream<CouchActiveTask[], Error>, Error>
  readonly compactDb: (dbName: string) => Effect.Effect<Stream.Stream<CouchActiveTask[], Error>, Error>
  readonly compactDesign: (dbName: string) => (
    designName: string
  ) => Effect.Effect<Stream.Stream<CouchActiveTask[], Error>, Error>
}

export const CompactService = Context.GenericTag<CompactService>('chtoolbox/CompactService');

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

export const CompactServiceLive = Layer.effect(CompactService, ServiceContext.pipe(Effect.map(
  context => CompactService.of({
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
  })
)));
