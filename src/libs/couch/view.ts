import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';

const getWarmRequest = (dbName: string, designName: string, viewName: string) => HttpClientRequest
  .get(`/${dbName}/_design/${designName}/_view/${viewName}`)
  .pipe(HttpClientRequest.setUrlParam('limit', '0'));

export const warmView = (
  dbName: string,
  designName: string,
  viewName: string
): Effect.Effect<void, Error, ChtClientService> => ChtClientService
  .request(getWarmRequest(dbName, designName, viewName))
  .pipe(
    Effect.andThen(Effect.void),
    Effect.scoped,
  );
