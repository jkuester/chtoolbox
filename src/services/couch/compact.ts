import { Schema } from 'effect';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const getCompactRequest = (dbName: string, designName?: string) => Schema
  .Struct({})
  .pipe(
    HttpClientRequest.schemaBodyJson,
    build => build(HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}),
    Effect.mapError(x => x as unknown as Error),
  );

const compact = (
  dbName: string,
  designName?: string
) => getCompactRequest(dbName, designName)
  .pipe(
    Effect.flatMap(request => ChtClientService.request(request)),
    Effect.andThen(Effect.void),
    Effect.scoped,
  );

export const compactDb = (dbName: string): Effect.Effect<void, Error, ChtClientService> => compact(dbName);
export const compactDesign = (
  dbName: string,
  designName: string
): Effect.Effect<void, Error, ChtClientService> => compact(dbName, designName);
