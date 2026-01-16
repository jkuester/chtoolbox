import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Option, pipe, Stream, Function } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info.ts';
import { getDesignDocNames } from '../libs/couch/design-docs.ts';
import { compactDb, compactDesign } from '../libs/couch/compact.ts';
import {
  CouchActiveTask,
  type CouchActiveTaskStream, filterStreamByDb, filterStreamByDesign,
  filterStreamByType,
  streamActiveTasks
} from '../libs/couch/active-tasks.ts';
import { mapErrorToGeneric, mapStreamErrorToGeneric, untilEmptyCount } from '../libs/core.ts';
import { ChtClientService } from './cht-client.ts';

const TYPE_DB_COMPACT = 'database_compaction';
const TYPE_VIEW_COMPACT = 'view_compaction';

const compactDbViews = Effect.fn((dbName: string) => getDesignDocNames(dbName)
  .pipe(
    Effect.map(Array.map(compactCouchDesign(dbName))),
    Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
  ));

const compactCouchDb = (compactDesigns: boolean) => Effect.fn((dbName: string) => pipe(
  Effect.suspend(() => compactDbViews(dbName)),
  Effect.when(() => compactDesigns),
  Effect.andThen(compactDb(dbName)),
));

const compactCouchDesign = (dbName: string) => (designName: string) => compactDesign(dbName, designName);

const compactAll = Effect.fn((compactDesigns: boolean) => getDbNames()
  .pipe(
    Effect.map(Array.map(compactCouchDb(compactDesigns))),
    Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
  ));

const streamActiveTasksUntilEmpty = () => streamActiveTasks()
  .pipe(Stream.takeUntilEffect(untilEmptyCount(5)));

const getActiveTaskTypeFilter = (compactDesigns: boolean) => pipe(
  [TYPE_DB_COMPACT, TYPE_VIEW_COMPACT],
  Option.liftPredicate(() => compactDesigns),
  Option.getOrElse(() => [TYPE_DB_COMPACT]),
  Function.tupled(filterStreamByType),
);

const streamAll = (compactDesigns: boolean) => streamActiveTasksUntilEmpty()
  .pipe(getActiveTaskTypeFilter(compactDesigns));

const streamDb = (dbName: string, compactDesigns: boolean) => pipe(
  streamAll(compactDesigns),
  filterStreamByDb(dbName)
);

const streamDesign = (dbName: string, designName: string) => pipe(
  streamActiveTasksUntilEmpty(),
  filterStreamByType(TYPE_VIEW_COMPACT),
  filterStreamByDesign(dbName, `_design/${designName}`),
);

const serviceContext = ChtClientService.pipe(Effect.map(cht => Context.make(ChtClientService, cht)));

export class CompactService extends Effect.Service<CompactService>()('chtoolbox/CompactService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    compactAll: Effect.fn((compactDesigns: boolean): Effect.Effect<CouchActiveTaskStream, Error> => pipe(
      compactAll(compactDesigns),
      Effect.andThen(streamAll(compactDesigns)),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    compactDb: Effect.fn((
      dbName: string,
      compactDesigns: boolean
    ): Effect.Effect<CouchActiveTaskStream, Error> => pipe(
      dbName,
      compactCouchDb(compactDesigns),
      Effect.andThen(streamDb(dbName, compactDesigns)),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    compactDesign: (dbName: string, designName: string): Stream.Stream<CouchActiveTask[], Error> => pipe(
      streamDesign(dbName, designName),
      Stream.onStart(compactCouchDesign(dbName)(designName)),
      mapStreamErrorToGeneric,
      Stream.provideContext(context),
    ),
  }))),
  accessors: true,
}) {
}
