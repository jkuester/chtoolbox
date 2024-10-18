import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { CouchService } from './couch';
import { Option } from 'effect';

class CouchDesign extends Schema.Class<CouchDesign>('CouchDesign')({
  _id: Schema.String,
  views: Schema.UndefinedOr(Schema.Object),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesign);
}

const serviceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export class CouchDesignService extends Effect.Service<CouchDesignService>()('chtoolbox/CouchDesignService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    getViewNames: (dbName: string, designName: string): Effect.Effect<string[], Error> => CouchService
      .request(HttpClientRequest.get(`/${dbName}/_design/${designName}`))
      .pipe(
        Effect.flatMap(CouchDesign.decodeResponse),
        Effect.scoped,
        Effect.map(design => design.views),
        Effect.map(Option.fromNullable),
        Effect.map(Option.map(Object.keys)),
        Effect.map(Option.getOrElse(() => [])),
        Effect.provide(context)
      ),
  }))),
  accessors: true,
}) {
}
