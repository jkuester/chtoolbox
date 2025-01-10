import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Match, Option, pipe, Stream } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { compactDb, compactDesign } from '../libs/couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
import {
  CouchActiveTasksService,
  CouchActiveTaskStream,
  filterStreamByType,
  getDbName,
  getDesignName
} from './couch/active-tasks';
import { untilEmptyCount } from '../libs/core';
import { ChtClientService } from './cht-client';

const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';

const compactDbViews = (dbName: string) => CouchDesignDocsService
  .getNames(dbName)
  .pipe(
    Effect.map(Array.map(compactCouchDesign(dbName))),
    Effect.flatMap(Effect.all),
  );

const compactCouchDb = (dbName: string, compactDesigns: boolean) => compactDb(dbName)
  .pipe(
    Effect.andThen(Match
      .value(compactDesigns)
      .pipe(
        Match.when(true, () => compactDbViews(dbName)),
        Match.orElse(() => Effect.void),
      )),
  );

const compactCouchDesign = (dbName: string) => (designName: string) => compactDesign(dbName, designName);

const compactAll = (compactDesigns: boolean) => getDbNames()
  .pipe(
    Effect.map(Array.map(dbName => compactCouchDb(dbName, compactDesigns))),
    Effect.flatMap(Effect.all),
  );

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

const serviceContext = Effect
  .all([
    CouchActiveTasksService,
    CouchDesignDocsService,
    CouchDesignInfoService,
    ChtClientService,
  ])
  .pipe(Effect.map(([
    activeTasks,
    designDocs,
    designInfo,
    chtClient,
  ]) => Context
    .make(CouchActiveTasksService, activeTasks)
    .pipe(
      Context.add(CouchDesignDocsService, designDocs),
      Context.add(CouchDesignInfoService, designInfo),
      Context.add(ChtClientService, chtClient),
    )));

export class CompactService extends Effect.Service<CompactService>()('chtoolbox/CompactService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    compactAll: (
      compactDesigns: boolean
    ): Effect.Effect<CouchActiveTaskStream, Error> => compactAll(compactDesigns)
      .pipe(
        Effect.andThen(streamAll(compactDesigns)),
        Effect.provide(context),
      ),
    compactDb: (
      dbName: string,
      compactDesigns: boolean
    ): Effect.Effect<CouchActiveTaskStream, Error> => compactCouchDb(dbName, compactDesigns)
      .pipe(
        Effect.andThen(streamDb(dbName, compactDesigns)),
        Effect.provide(context),
      ),
    compactDesign: (dbName: string) => (
      designName: string
    ): Effect.Effect<CouchActiveTaskStream, Error> => compactCouchDesign(dbName)(designName)
      .pipe(
        Effect.andThen(streamDesign(dbName, designName)),
        Effect.provide(context),
      ),
  }))),
  accessors: true,
}) {
}
