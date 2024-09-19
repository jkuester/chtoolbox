import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array } from 'effect';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect, CouchService } from './couch';

export class CouchDesignDocs extends Schema.Class<CouchDesignDocs>('CouchDesignDocs')({
  rows: Schema.Array(Schema.Struct({
    id: Schema.String,
  })),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchDesignDocs);
}

export interface CouchDesignDocsService {
  readonly getNames: (dbName: string) => CouchResponseEffect<readonly string[]>
}

export const CouchDesignDocsService = Context.GenericTag<CouchDesignDocsService>('chtoolbox/CouchDesignDocsService');

export const CouchDesignDocsServiceLive = Layer.succeed(CouchDesignDocsService, CouchDesignDocsService.of({
  getNames: (dbName: string) => CouchService.pipe(
    Effect.flatMap(couch => couch.request(HttpClientRequest.get(`/${dbName}/_design_docs`))),
    CouchDesignDocs.decodeResponse,
    Effect.map(designDocs => designDocs.rows),
    Effect.map(Array.map(({ id }) => id)),
    Effect.map(Array.map(id => id.split('/')[1])),
  ),
}));
