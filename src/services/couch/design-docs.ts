import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Array } from 'effect';
import { ChtClientService } from '../cht-client';

class CouchDesignDocs extends Schema.Class<CouchDesignDocs>('CouchDesignDocs')({
  rows: Schema.Array(Schema.Struct({
    id: Schema.String,
  })),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignDocs);
}

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class CouchDesignDocsService extends Effect.Service<CouchDesignDocsService>()(
  'chtoolbox/CouchDesignDocsService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      getNames: (dbName: string) => ChtClientService
        .request(HttpClientRequest.get(`/${dbName}/_design_docs`))
        .pipe(
          Effect.flatMap(CouchDesignDocs.decodeResponse),
          Effect.scoped,
          Effect.map(designDocs => designDocs.rows),
          Effect.map(Array.map(({ id }) => id)),
          Effect.map(Array.map(id => id.split('/')[1])),
          Effect.provide(context),
        ),
    }))),
    accessors: true,
  }
) {
}
