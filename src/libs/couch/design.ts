import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { Option, pipe, Schema } from 'effect';
import type { RequestError } from '@effect/platform/HttpClientError';

export class CouchDesign extends Schema.Class<CouchDesign>('CouchDesign')({
  _id: Schema.String,
  _rev: Schema.UndefinedOr(Schema.String),
  views: Schema.UndefinedOr(Schema.Object),
  deploy_info: Schema.UndefinedOr(Schema.Struct({
    user: Schema.UndefinedOr(Schema.String),
    upgrade_log_id: Schema.UndefinedOr(Schema.String),
  })),
  nouveau: Schema.UndefinedOr(Schema.Object),
  build_info: Schema.UndefinedOr(Schema.Struct({
    base_version: Schema.UndefinedOr(Schema.String),
  })),
}) {}
export class CouchDesignWithRev extends Schema.Class<CouchDesignWithRev>('CouchDesignWithRev')({
  ...CouchDesign.fields,
  _rev: Schema.String,
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(
    CouchDesignWithRev,
    { onExcessProperty: 'preserve' }
  );
}

export const getCouchDesign = Effect.fn((dbName: string, designName: string) => pipe(
  HttpClientRequest.get(`/${dbName}/_design/${designName}`),
  ChtClientService.request,
  Effect.flatMap(CouchDesignWithRev.decodeResponse),
  Effect.scoped,
));

export const getViewNames = Effect.fn((dbName: string, designName: string) => pipe(
  getCouchDesign(dbName, designName),
  Effect.map(({ views }) => Option.fromNullable(views)),
  Effect.map(Option.map(Object.keys)),
  Effect.map(Option.getOrElse(() => [])),
));

export const deleteCouchDesign = (
  dbName: string
): (ddoc: CouchDesign) => Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  RequestError | Error,
  ChtClientService
> => Effect.fn((ddoc) => pipe(
  ddoc,
  Schema.decodeUnknownSync(CouchDesignWithRev),
  ddocWithRev => pipe(
    HttpClientRequest.del(`/${dbName}/${ddocWithRev._id}`),
    HttpClientRequest.setUrlParam('rev', ddocWithRev._rev)
  ),
  ChtClientService.request,
  Effect.scoped,
));
