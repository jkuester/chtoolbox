import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array, Stream } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info.js';
import { getDesignDocNames } from '../libs/couch/design-docs.js';
import { getViewNames } from '../libs/couch/design.js';
import { warmView } from '../libs/couch/view.js';
import { getDesignInfo } from '../libs/couch/design-info.js';
import { ChtClientService } from './cht-client.js';
import { CouchActiveTask, filterStreamByType, streamActiveTasks } from '../libs/couch/active-tasks.js';

const warmCouchView = (dbName: string, designId: string) => (
  viewName: string
) => warmView(dbName, designId, viewName);

const warmAll = () => getDbNames()
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
  );

const designsCurrentlyUpdating = () => getDbNames()
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
  );

const isDesignUpdating = (dbName: string, designId: string) => getDesignInfo(dbName, designId).pipe(
  Effect.tap(({ view_index }) => Effect.logDebug(`${dbName}/${designId} updater_running: ${view_index.updater_running.toString()}`)),
  Effect.map(({ view_index }) => view_index.updater_running),
);

const warmDesignViews =  (dbName: string, designId: string) => Effect
  .logDebug(`Warming views for ${dbName}/${designId}`)
  .pipe(
    Effect.andThen(getViewNames(dbName, designId)),
    Effect.map(Array.map(warmCouchView(dbName, designId))),
    Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
    Effect.timeout(1000),
    Effect.catchTag("TimeoutException", () => Effect.logDebug(`Timeout warming ${dbName}/${designId}`)),
  );

const isWarm = (dbName: string, designId: string) => Effect.all([
  warmDesignViews(dbName, designId),
  isDesignUpdating(dbName, designId)
]).pipe(Effect.map(([, updating]) => !updating));

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class WarmViewsService extends Effect.Service<WarmViewsService>()('chtoolbox/WarmViewsService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    warmAll: (): Effect.Effect<void, Error> => warmAll()
      .pipe(Effect.provide(context)),
    designsCurrentlyUpdating: (): Effect.Effect<{
      dbName: string,
      designId: string
    }[], Error> => designsCurrentlyUpdating()
      .pipe(Effect.provide(context)),
    warmDesign: (
      dbName: string,
      designId: string
    ): Stream.Stream<CouchActiveTask[], Error> => streamActiveTasks().pipe(
      filterStreamByType('indexer'),
      Stream.map(Array.filter(({ design_document }) => design_document === `_design/${designId}`)),
      Stream.takeUntilEffect(() => isWarm(dbName, designId)),
      Stream.provideContext(context),
    )
  }))),
  accessors: true,
}) {
}
