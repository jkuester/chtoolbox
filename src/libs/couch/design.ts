import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { Option, Schema } from 'effect';

export class CouchDesign extends Schema.Class<CouchDesign>('CouchDesign')({
  _id: Schema.String,
  views: Schema.UndefinedOr(Schema.Object),
  deploy_info: Schema.UndefinedOr(Schema.Struct({
    user: Schema.UndefinedOr(Schema.String),
    upgrade_log_id: Schema.UndefinedOr(Schema.String),
  })),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesign);
}

export const getViewNames = (
  dbName: string,
  designName: string
): Effect.Effect<string[], Error, ChtClientService> => ChtClientService
  .request(HttpClientRequest.get(`/${dbName}/_design/${designName}`))
  .pipe(
    Effect.flatMap(CouchDesign.decodeResponse),
    Effect.scoped,
    Effect.map(design => design.views),
    Effect.map(Option.fromNullable),
    Effect.map(Option.map(Object.keys)),
    Effect.map(Option.getOrElse(() => [])),
  );
