import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array } from 'effect';
import { getDbNames } from '../libs/couch/dbs-info';
import { getDesignDocNames } from '../libs/couch/design-docs';
import { getViewNames } from '../libs/couch/design';
import { CouchViewService } from './couch/view';
import { getDesignInfo } from '../libs/couch/design-info';
import { ChtClientService } from './cht-client';

const warmView = (dbName: string, designId: string) => (
  viewName: string
) => CouchViewService.warm(dbName, designId, viewName);

const warmAll = () => getDbNames()
  .pipe(
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

const designsCurrentlyUpdating = () => getDbNames()
  .pipe(
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

const serviceContext = Effect
  .all([
    ChtClientService,
    CouchViewService,
  ])
  .pipe(Effect.map(([
    chtClient,
    couchView,
  ]) => Context
    .make(ChtClientService, chtClient)
    .pipe(
      Context.add(CouchViewService, couchView),
    )));

export class WarmViewsService extends Effect.Service<WarmViewsService>()('chtoolbox/WarmViewsService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    warmAll: (): Effect.Effect<void, Error> => warmAll()
      .pipe(Effect.provide(context)),
    designsCurrentlyUpdating: (): Effect.Effect<{
      dbName: string,
      designId: string
    }[], Error> => designsCurrentlyUpdating()
      .pipe(Effect.provide(context)),
  }))),
  accessors: true,
}) {
}
