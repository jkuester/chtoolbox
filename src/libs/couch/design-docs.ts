import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { Array, Schema } from 'effect';
import { ChtClientService } from '../../services/cht-client.ts';

class CouchDesignDocs extends Schema.Class<CouchDesignDocs>('CouchDesignDocs')({
  rows: Schema.Array(Schema.Struct({
    id: Schema.String,
  })),
}) {
  static readonly decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesignDocs);
}

export const getDesignDocNames = (dbName: string): Effect.Effect<string[], Error, ChtClientService> => ChtClientService
  .request(HttpClientRequest.get(`/${dbName}/_design_docs`))
  .pipe(
    Effect.flatMap(CouchDesignDocs.decodeResponse),
    Effect.scoped,
    Effect.map(designDocs => designDocs.rows),
    Effect.map(Array.map(({ id }) => id)),
    Effect.map(Array.map(id => id.split('/')[1])),
  );
