import { Schema } from 'effect';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const getCompactRequest = Effect.fn((dbName: string, designName?: string) => Schema
  .Struct({})
  .pipe(
    HttpClientRequest.schemaBodyJson,
    build => build(HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}),
    Effect.mapError(x => x as unknown as Error),
  ));

const compact = Effect.fn(
  (dbName: string, designName?: string) => getCompactRequest(dbName, designName),
  Effect.flatMap(request => ChtClientService.request(request)),
  Effect.andThen(Effect.void),
  Effect.scoped,
);

export const compactDb = Effect.fn((dbName: string): Effect.Effect<void, Error, ChtClientService> => compact(dbName));
export const compactDesign = Effect.fn((
  dbName: string,
  designName: string
): Effect.Effect<void, Error, ChtClientService> => compact(dbName, designName));
