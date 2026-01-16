import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Boolean, Function, Option, pipe, Stream } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info.ts';
import { getDesignDocNames } from '../libs/couch/design-docs.ts';
import { CouchDesignWithRev, getCouchDesign, getViewNames } from '../libs/couch/design.ts';
import { warmView } from '../libs/couch/view.ts';
import { getDesignInfo } from '../libs/couch/design-info.ts';
import { ChtClientService } from './cht-client.ts';
import {
  activeTasksEffect,
  CouchActiveTask,
  filterStreamByType,
  streamActiveTasks,
  taskHasType
} from '../libs/couch/active-tasks.ts';
import { warmNouveau } from '../libs/couch/nouveau.ts';

const warmCouchView = (dbName: string, designId: string) => Effect.fn((
  viewName: string
) => warmView(dbName, designId, viewName));

const warmAll = Effect.fn(() => getDbNames()
  .pipe(
    Effect.map(Array.map(dbName => getDesignDocNames(dbName)
      .pipe(
        Effect.map(Array.map(designName => getViewNames(dbName, designName)
          .pipe(
            Effect.map(Array.map(warmCouchView(dbName, designName))),
            Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
          ))),
        Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
        Effect.map(Array.flatten),
      ))),
    Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
    Effect.map(Array.flatten),
  ));

const designsCurrentlyUpdating = Effect.fn(() => getDbNames()
  .pipe(
    Effect.map(Array.map(dbName => getDesignDocNames(dbName)
      .pipe(
        Effect.map(Array.map(designId => getDesignInfo(dbName, designId))),
        Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
        Effect.map(Array.filter(designInfo => designInfo.view_index.updater_running)),
        Effect.map(Array.map(designInfo => ({ dbName, designId: designInfo.name }))),
      ))),
    Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
    Effect.map(Array.flatten),
  ));

const isDesignViewsUpdating = Effect.fn((dbName: string, designId: string) => pipe(
  getDesignInfo(dbName, designId),
  Effect.tap(({ view_index }) => Effect.logDebug(
    `${dbName}/${designId} updater_running: ${view_index.updater_running.toString()}`
  )),
  Effect.map(({ view_index }) => view_index.updater_running),
));

const taskForDdoc = (ddocId: string) => (task: CouchActiveTask) => task.design_document === ddocId;

const isDesignNouveauUpdating = Effect.fn((ddocId: string) => pipe(
  activeTasksEffect,
  Effect.map(Array.filter(taskHasType('search_indexer'))),
  Effect.map(Array.filter(taskForDdoc(ddocId))),
  Effect.map(Array.isNonEmptyArray)
));

const isDesignUpdating = Effect.fn((dbName: string, designId: string) => pipe(
  Effect.all([
    isDesignViewsUpdating(dbName,  designId),
    isDesignNouveauUpdating(`_design/${designId}`)
  ], { concurrency: 'unbounded' }),
  Effect.map(Function.tupled(Boolean.or)),
));

const warmDesignViews =  Effect.fn((dbName: string, designId: string, { views }: CouchDesignWithRev) => pipe(
  Option.fromNullable(views),
  Option.map(Object.keys),
  Option.getOrElse(() => []),
  Array.map(view => warmView(dbName, designId, view)),
  Effect.allWith({ concurrency: 'unbounded' }),
));

const warmDesignNouveaus = Effect.fn((dbName: string, { _id, nouveau }: CouchDesignWithRev) => pipe(
  Option.fromNullable(nouveau),
  Option.map(Object.keys),
  Option.getOrElse(() => []),
  Array.map(warmNouveau(dbName, _id)),
  Effect.allWith({ concurrency: 'unbounded' }),
));

const warmDesign = (dbName: string, designId: string) => pipe(
  Effect.logDebug(`Warming views for ${dbName}/${designId}`),
  Effect.andThen(() => getCouchDesign(dbName, designId)),
  Effect.flatMap((ddoc) => Effect.all([
    warmDesignViews(dbName, designId, ddoc),
    warmDesignNouveaus(dbName, ddoc)
  ], { concurrency: 'unbounded' })),
  Effect.timeout(1000),
  Effect.catchTag('TimeoutException', () => Effect.logDebug(`Timeout warming ${dbName}/${designId}`)),
);

const isWarm = Effect.fn((dbName: string, designId: string) => pipe(
  Effect.all([
    warmDesign(dbName, designId),
    isDesignUpdating(dbName, designId),
  ]),
  Effect.map(([, updating]) => !updating),
));

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class WarmViewsService extends Effect.Service<WarmViewsService>()('chtoolbox/WarmViewsService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    warmAll: Effect.fn((): Effect.Effect<void, Error> => warmAll()
      .pipe(Effect.provide(context))),
    designsCurrentlyUpdating: Effect.fn((): Effect.Effect<{
      dbName: string,
      designId: string
    }[], Error> => designsCurrentlyUpdating()
      .pipe(Effect.provide(context))),
    warmDesign: (
      dbName: string,
      designId: string
    ): Stream.Stream<CouchActiveTask[], Error> => streamActiveTasks().pipe(
      filterStreamByType('indexer', 'search_indexer'),
      Stream.map(Array.filter(taskForDdoc(`_design/${designId}`))),
      Stream.takeUntilEffect(() => isWarm(dbName, designId)),
      Stream.provideContext(context),
    )
  }))),
  accessors: true,
}) {
}
