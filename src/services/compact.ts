import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Array, pipe } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';

export interface CompactService {
  readonly compactAll: Effect.Effect<void, Error>
  readonly currentlyCompacting: Effect.Effect<string[], Error>
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

const ServiceContext = Effect
  .all([
    CouchDbsInfoService,
    CouchDesignDocsService,
    CouchCompactService,
    CouchDesignInfoService,
  ])
  .pipe(Effect.map(([
    dbsInfo,
    designDocs,
    compact,
    designInfo
  ]) => Context
    .make(CouchDbsInfoService, dbsInfo)
    .pipe(
      Context.add(CouchDesignDocsService, designDocs),
      Context.add(CouchCompactService, compact),
      Context.add(CouchDesignInfoService, designInfo),
    )));

export const CompactServiceLive = Layer.effect(CompactService, ServiceContext.pipe(Effect.map(
  context => CompactService.of({
    compactAll: compactAll.pipe(Effect.provide(context)),
    currentlyCompacting: currentlyCompacting.pipe(Effect.provide(context)),
  })
)));
