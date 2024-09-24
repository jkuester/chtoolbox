import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignService } from './couch/design';
import { CouchViewService } from './couch/view';
import { CouchDesignInfoService } from './couch/design-info';

export interface WarmViewsService {
  readonly warmAll: Effect.Effect<void, Error>,
  readonly designsCurrentlyUpdating: Effect.Effect<{ dbName: string, designId: string }[], Error>
}

export const WarmViewsService = Context.GenericTag<WarmViewsService>('chtoolbox/WarmViewsService');

const dbNames = CouchDbsInfoService.pipe(
  Effect.flatMap(infoService => infoService.getDbNames()),
);

const getDesignDocNames = (dbName: string) => CouchDesignDocsService.pipe(
  Effect.flatMap(designDocsService => designDocsService.getNames(dbName)),
);

const getViewNames = (dbName: string, designId: string) => CouchDesignService.pipe(
  Effect.flatMap(designService => designService.getViewNames(dbName, designId)),
);

const warmView = (dbName: string, designId: string) => (viewName: string) => CouchViewService.pipe(
  Effect.flatMap(viewService => viewService.warm(dbName, designId, viewName)),
);

const getDesignInfo = (dbName: string, designId: string) => CouchDesignInfoService.pipe(
  Effect.flatMap(designInfoService => designInfoService.get(dbName, designId)),
);

const warmAll = dbNames.pipe(
  Effect.map(Array.map(dbName => getDesignDocNames(dbName)
    .pipe(
      Effect.map(Array.map(designName => getViewNames(dbName, designName)
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

const designsCurrentlyUpdating = dbNames.pipe(
  Effect.map(Array.map(dbName => getDesignDocNames(dbName)
    .pipe(
      Effect.map(Array.map(designId => getDesignInfo(dbName, designId))),
      Effect.flatMap(Effect.all),
      Effect.map(Array.filter(designInfo => designInfo.view_index.updater_running)),
      Effect.map(Array.map(designInfo => ({ dbName, designId: designInfo.name }))),
    ))),
  Effect.flatMap(Effect.all),
  Effect.map(Array.flatten),
);

const ServiceContext = Effect
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

export const WarmViewsServiceLive = Layer.effect(WarmViewsService, ServiceContext.pipe(Effect.map(
  contect => WarmViewsService.of({
    warmAll: warmAll.pipe(Effect.provide(contect)),
    designsCurrentlyUpdating: designsCurrentlyUpdating.pipe(Effect.provide(contect)),
  })
)));
