import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
import { Option } from 'effect';

class CouchDesign extends Schema.Class<CouchDesign>('CouchDesign')({
  _id: Schema.String,
  views: Schema.UndefinedOr(Schema.Object),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesign);
}

export interface CouchDesignService {
  readonly getViewNames: (dbName: string, designName: string) => Effect.Effect<string[], Error>
}

export const CouchDesignService = Context.GenericTag<CouchDesignService>('chtoolbox/CouchDesignService');

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchDesignServiceLive = Layer.effect(CouchDesignService, ServiceContext.pipe(Effect.map(
  context => CouchDesignService.of({
    getViewNames: (dbName: string, designName: string) => CouchService.pipe(
      Effect.flatMap(couch => couch.request(HttpClientRequest.get(`/${dbName}/_design/${designName}`))),
      Effect.flatMap(CouchDesign.decodeResponse),
      Effect.scoped,
      Effect.map(design => design.views),
      Effect.map(Option.fromNullable),
      Effect.map(Option.map(Object.keys)),
      Effect.map(Option.getOrElse(() => [])),
      Effect.provide(context)
    ),
  })
)));
