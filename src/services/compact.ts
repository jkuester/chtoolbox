import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Match, Option, pipe, Stream } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info';
import { getDesignDocNames } from '../libs/couch/design-docs';
import { compactDb, compactDesign } from '../libs/couch/compact';
import {
  CouchActiveTaskStream,
  filterStreamByType,
  getDbName,
  getDesignName,
  streamActiveTasks
} from '../libs/couch/active-tasks';
import { untilEmptyCount } from '../libs/core';
import { ChtClientService } from './cht-client';

const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';

const compactDbViews = (dbName: string) => getDesignDocNames(dbName)
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

const streamActiveTasksUntilEmpty = () => streamActiveTasks()
  .pipe(Stream.takeUntilEffect(untilEmptyCount(5)));

const getActiveTaskTypeFilter = (compactDesigns: boolean) => pipe(
  [TYPE_DB_COMPACT, TYPE_VIEW_COMPACT],
  Option.liftPredicate(() => compactDesigns),
  Option.getOrElse(() => [TYPE_DB_COMPACT]),
  types => filterStreamByType(...types),
);

const streamAll = (compactDesigns: boolean) => streamActiveTasksUntilEmpty()
  .pipe(getActiveTaskTypeFilter(compactDesigns));

const streamDb = (dbName: string, compactDesigns: boolean) => streamAll(compactDesigns)
  .pipe(Stream.map(Array.filter(task => getDbName(task) === dbName)));


const streamDesign = (dbName: string, designName: string) => streamActiveTasksUntilEmpty()
  .pipe(
    filterStreamByType(TYPE_VIEW_COMPACT),
    Stream.map(Array.filter(task => getDbName(task) === dbName)),
    Stream.map(Array.filter(task => getDesignName(task)
      .pipe(
        Option.map(name => name === designName),
        Option.getOrElse(() => false),
      ))),
  );

const serviceContext = ChtClientService.pipe(Effect.map(cht => Context.make(ChtClientService, cht)));

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
