import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array, Console, pipe } from 'effect';
import { CouchDbsInfoService, CouchDbsInfoServiceLive } from './couch/dbs-info';
import { CouchDesignDocsService, CouchDesignDocsServiceLive } from './couch/design-docs';
import { CouchCompactService, CouchCompactServiceLive } from './couch/compact';
import { CouchResponseEffect, CouchServiceLive } from './couch/couch';
import { CouchDesignInfoService, CouchDesignInfoServiceLive } from './couch/design-info';
import { NodeContext, NodeHttpClient } from '@effect/platform-node';
import { EnvironmentServiceLive } from './environment';
import { CouchNodeSystemServiceLive } from './couch/node-system';
import { CouchDesignServiceLive } from './couch/design';
import { CouchViewServiceLive } from './couch/view';
import { LocalDiskUsageServiceLive } from './local-disk-usage';
import { MonitorServiceLive } from './monitor';
import { WarmViewsServiceLive } from './warm-views';

export interface CompactService {
  readonly compactAll: CouchResponseEffect<
    void,
    never,
    CouchDbsInfoService | CouchDesignDocsService | CouchCompactService
  >
  readonly currentlyCompacting: CouchResponseEffect<
    string[],
    never,
    CouchDbsInfoService | CouchDesignInfoService | CouchDesignDocsService
  >
}

export const CompactService = Context.GenericTag<CompactService>('chtoolbox/CompactService');

const dbNames = CouchDbsInfoService.pipe(
  Effect.flatMap(infoService => infoService.getDbNames()),
);

const dbsInfo = CouchDbsInfoService.pipe(
  Effect.flatMap(infoService => infoService.get()),
);

const getDesignDocNames = (dbName: string) => CouchDesignDocsService.pipe(
  Effect.flatMap(designDocsService => designDocsService.getNames(dbName)),
);

const getDesignInfo = (dbName: string) => (designId: string) => CouchDesignInfoService.pipe(
  Effect.flatMap(designInfoService => designInfoService.get(dbName, designId)),
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

const getCurrentlyCompactingDesignNames = (dbName: string) => getDesignDocNames(dbName)
  .pipe(
    Effect.map(Array.map(getDesignInfo(dbName))),
    Effect.flatMap(Effect.all),
    Effect.map(Array.filter(designInfo => designInfo.view_index.compact_running)),
    Effect.map(Array.map(designInfo => `${dbName}/${designInfo.name}`))
  );

const currentlyCompacting = dbsInfo.pipe(
  Effect.map(Array.map(dbInfo => getCurrentlyCompactingDesignNames(dbInfo.key)
    .pipe(
      Effect.map(viewNames => [
        ...viewNames,
        ...(dbInfo.info.compact_running ? [dbInfo.key] : []),
      ]),
    ))),
  Effect.flatMap(Effect.all),
  Effect.map(Array.flatten),
);

export const CompactServiceLive = Layer.succeed(CompactService, CompactService.of({
  compactAll,
  currentlyCompacting,
}));
