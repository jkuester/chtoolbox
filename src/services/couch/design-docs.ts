import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array } from 'effect';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

export class CouchDesignDocs extends Schema.Class<CouchDesignDocs>('CouchDesignDocs')({
  rows: Schema.Array(Schema.Struct({
    id: Schema.String,
  })),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJsonScoped(CouchDesignDocs);
}

export interface CouchDesignDocsService {
  readonly getNames: (dbName: string) => Effect.Effect<readonly string[], Error>
}

export const CouchDesignDocsService = Context.GenericTag<CouchDesignDocsService>('chtoolbox/CouchDesignDocsService');

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchDesignDocsServiceLive = Layer.effect(CouchDesignDocsService, ServiceContext.pipe(Effect.map(
  context => CouchDesignDocsService.of({
    getNames: (dbName: string) => CouchService.pipe(
      Effect.flatMap(couch => couch.request(HttpClientRequest.get(`/${dbName}/_design_docs`))),
      CouchDesignDocs.decodeResponse,
      Effect.map(designDocs => designDocs.rows),
      Effect.map(Array.map(({ id }) => id)),
      Effect.map(Array.map(id => id.split('/')[1])),
      Effect.provide(context),
    ),
  })
)));
