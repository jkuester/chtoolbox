import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect, CouchService } from './couch';
import { Option } from 'effect';

class CouchDesign extends Schema.Class<CouchDesign>('CouchDesign')({
  _id: Schema.String,
  views: Schema.UndefinedOr(Schema.Object),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchDesign);
}

export interface CouchDesignService {
  readonly getViewNames: (dbName: string, designName: string) => CouchResponseEffect<string[]>
}

export const CouchDesignService = Context.GenericTag<CouchDesignService>('chtoolbox/CouchDesignService');

export const CouchDesignServiceLive = Layer.succeed(CouchDesignService, CouchDesignService.of({
  getViewNames: (dbName: string, designName: string) => CouchService.pipe(
    Effect.flatMap(couch => couch.request(HttpClientRequest.get(`/${dbName}/_design/${designName}`))),
    CouchDesign.decodeResponse,
    Effect.map(design => design.views),
    Effect.map(Option.fromNullable),
    Effect.map(Option.map(Object.keys)),
    Effect.map(Option.getOrElse(() => [])),
  ),
}));
