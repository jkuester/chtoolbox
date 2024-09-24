import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

export interface CouchViewService {
  readonly warm: (dbName: string, designName: string, viewName: string) => Effect.Effect<void, Error>
}

export const CouchViewService = Context.GenericTag<CouchViewService>('chtoolbox/CouchViewService');

const getWarmRequest = (dbName: string, designName: string, viewName: string) => HttpClientRequest
  .get(`/${dbName}/_design/${designName}/_view/${viewName}`)
  .pipe(HttpClientRequest.setUrlParam('limit', '0'));

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchViewServiceLive = Layer.effect(CouchViewService, ServiceContext.pipe(Effect.map(
  context => CouchViewService.of({
    warm: (dbName: string, designName: string, viewName: string) => CouchService.pipe(
      Effect.flatMap(couch => couch.request(getWarmRequest(dbName, designName, viewName))),
      Effect.andThen(Effect.void),
      Effect.scoped,
      Effect.provide(context),
    ),
  }),
)));
