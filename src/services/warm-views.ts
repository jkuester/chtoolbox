import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignService } from './couch/design';
import { CouchView, CouchViewService } from './couch/view';
import { CouchResponseEffect } from './couch/couch';
import { CouchDesignInfoService } from './couch/design-info';

export interface WarmViewsService {
  readonly warmAll: CouchResponseEffect<
    readonly CouchView[],
    never,
    CouchDbsInfoService | CouchDesignDocsService | CouchDesignService | CouchViewService
  >,
  readonly designsCurrentlyUpdating: CouchResponseEffect<
    { dbName: string, designId: string }[],
    never,
    CouchDbsInfoService | CouchDesignDocsService | CouchDesignInfoService
  >
}

export const WarmViewsService = Context.GenericTag<WarmViewsService>('chtoolbox/WarmViewsService');

const dbNames = CouchDbsInfoService.pipe(
  Effect.flatMap(infoService => infoService.getDbNames()),
);

const getDesignDocIds = (dbName: string) => CouchDesignDocsService.pipe(
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
  Effect.map(Array.map(dbName => getDesignDocIds(dbName)
    .pipe(
      Effect.map(Array.map(designId => getViewNames(dbName, designId)
        .pipe(
          Effect.map(Array.map(warmView(dbName, designId))),
          Effect.flatMap(Effect.all),
        ))),
      Effect.flatMap(Effect.all),
      Effect.map(Array.flatten),
    ))),
  Effect.flatMap(Effect.all),
  Effect.map(Array.flatten),
);

const designsCurrentlyUpdating = dbNames.pipe(
  Effect.map(Array.map(dbName => getDesignDocIds(dbName)
    .pipe(
      Effect.map(Array.map(designId => getDesignInfo(dbName, designId))),
      Effect.flatMap(Effect.all),
      Effect.map(Array.filter(designInfo => designInfo.view_index.updater_running)),
      Effect.map(Array.map(designInfo => ({ dbName, designId: designInfo.name }))),
    ))),
  Effect.flatMap(Effect.all),
  Effect.map(Array.flatten),
);

export const WarmViewsServiceLive = Layer.succeed(WarmViewsService, WarmViewsService.of({
  warmAll,
  designsCurrentlyUpdating,
}));

// (async () => {
//   await Effect.runPromise(WarmViewsService.pipe(
//     Effect.flatMap(s => s.warmAll),
//     Effect.provide(NodeContext.layer),
//     Effect.provide(NodeHttpClient.layer),
//     Effect.provide(EnvironmentServiceLive),
//     Effect.provide(CouchServiceLive),
//     Effect.provide(CouchNodeSystemServiceLive),
//     Effect.provide(CouchDbsInfoServiceLive),
//     Effect.provide(CouchDesignDocsServiceLive),
//     Effect.provide(CouchDesignInfoServiceLive),
//     Effect.provide(CouchDesignServiceLive),
//     Effect.provide(CouchViewServiceLive),
//     Effect.provide(LocalDiskUsageServiceLive),
//     Effect.provide(MonitorServiceLive),
//     Effect.provide(WarmViewsServiceLive),
//   ));
//
//   await Effect.runPromise(anyDesignUpdating.pipe(
//     Effect.provide(NodeContext.layer),
//     Effect.provide(NodeHttpClient.layer),
//     Effect.provide(EnvironmentServiceLive),
//     Effect.provide(CouchServiceLive),
//     Effect.provide(CouchNodeSystemServiceLive),
//     Effect.provide(CouchDbsInfoServiceLive),
//     Effect.provide(CouchDesignDocsServiceLive),
//     Effect.provide(CouchDesignInfoServiceLive),
//     Effect.provide(CouchDesignServiceLive),
//     Effect.provide(CouchViewServiceLive),
//     Effect.provide(LocalDiskUsageServiceLive),
//     Effect.provide(MonitorServiceLive),
//     Effect.provide(WarmViewsServiceLive),
//   ));
// })();
