import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignService } from './couch/design';
import { CouchViewService } from './couch/view';
import { CouchDesignInfoService } from './couch/design-info';

const warmView = (dbName: string, designId: string) => (
  viewName: string
) => CouchViewService.warm(dbName, designId, viewName);

const warmAll = CouchDbsInfoService
  .getDbNames()
  .pipe(
    Effect.map(Array.map(dbName => CouchDesignDocsService
      .getNames(dbName)
      .pipe(
        Effect.map(Array.map(designName => CouchDesignService
          .getViewNames(dbName, designName)
          .pipe(
            Effect.map(Array.map(warmView(dbName, designName))),
            Effect.flatMap(Effect.all),
          ))),
        Effect.flatMap(Effect.all),
        Effect.map(Array.flatten),
      ))),
    Effect.flatMap(Effect.all),
    Effect.map(Array.flatten),
  );

const designsCurrentlyUpdating = CouchDbsInfoService
  .getDbNames()
  .pipe(
    Effect.map(Array.map(dbName => CouchDesignDocsService
      .getNames(dbName)
      .pipe(
        Effect.map(Array.map(designId => CouchDesignInfoService.get(dbName, designId))),
        Effect.flatMap(Effect.all),
        Effect.map(Array.filter(designInfo => designInfo.view_index.updater_running)),
        Effect.map(Array.map(designInfo => ({ dbName, designId: designInfo.name }))),
      ))),
    Effect.flatMap(Effect.all),
    Effect.map(Array.flatten),
  );

const serviceContext = Effect
  .all([
    CouchDbsInfoService,
    CouchDesignDocsService,
    CouchDesignService,
    CouchViewService,
    CouchDesignInfoService,
  ])
  .pipe(Effect.map(([
    couchDbsInfo,
    couchDesignDocs,
    couchDesign,
    couchView,
    couchDesignInfo
  ]) => Context
    .make(CouchDbsInfoService, couchDbsInfo)
    .pipe(
      Context.add(CouchDesignDocsService, couchDesignDocs),
      Context.add(CouchDesignService, couchDesign),
      Context.add(CouchViewService, couchView),
      Context.add(CouchDesignInfoService, couchDesignInfo),
    )));

export class WarmViewsService extends Effect.Service<WarmViewsService>()('chtoolbox/WarmViewsService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    warmAll: () => warmAll.pipe(Effect.provide(context)),
    designsCurrentlyUpdating: () => designsCurrentlyUpdating.pipe(Effect.provide(context)),
  }))),
  accessors: true,
}) {
}
