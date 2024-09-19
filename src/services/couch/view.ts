import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect, CouchService } from './couch';

export class CouchView extends Schema.Class<CouchView>('CouchView')({
  total_rows: Schema.UndefinedOr(Schema.Number),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchView);
}

export interface CouchViewService {
  readonly warm: (dbName: string, designName: string, viewName: string) => CouchResponseEffect<CouchView>
}

export const CouchViewService = Context.GenericTag<CouchViewService>('chtoolbox/CouchViewService');

const getWarmRequest = (dbName: string, designName: string, viewName: string) => HttpClientRequest
  .get(`/${dbName}/_design/${designName}/_view/${viewName}`)
  .pipe(HttpClientRequest.setUrlParam('limit', '0'));

export const CouchViewServiceLive = Layer.succeed(CouchViewService, CouchViewService.of({
  warm: (dbName: string, designName: string, viewName: string) => CouchService.pipe(
    Effect.flatMap(couch => couch.request(getWarmRequest(dbName, designName, viewName))),
    CouchView.decodeResponse,
  )
}));
