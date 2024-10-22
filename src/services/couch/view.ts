import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { ChtClientService } from '../cht-client';

const getWarmRequest = (dbName: string, designName: string, viewName: string) => HttpClientRequest
  .get(`/${dbName}/_design/${designName}/_view/${viewName}`)
  .pipe(HttpClientRequest.setUrlParam('limit', '0'));

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class CouchViewService extends Effect.Service<CouchViewService>()('chtoolbox/CouchViewService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    warm: (dbName: string, designName: string, viewName: string) => ChtClientService
      .request(getWarmRequest(dbName, designName, viewName))
      .pipe(
        Effect.andThen(Effect.void),
        Effect.scoped,
        Effect.provide(context),
      ),
  }))),
  accessors: true,
}) {
}
