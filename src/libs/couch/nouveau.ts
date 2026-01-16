import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { pipe } from 'effect';
import type { RequestError } from '@effect/platform/HttpClientError';

export const warmNouveau = (
  dbName: string,
  ddocId: string
): (n: string) => Effect.Effect<void, RequestError | Error, ChtClientService> => Effect.fn((indexName) => pipe(
  HttpClientRequest.get(`/${dbName}/${ddocId}/_nouveau/${indexName}`),
  HttpClientRequest.setUrlParam('limit', '1'),
  HttpClientRequest.setUrlParam('q', '*:*'),
  ChtClientService.request,
  Effect.andThen(Effect.void),
  Effect.scoped,
));
