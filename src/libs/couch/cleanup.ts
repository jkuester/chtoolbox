import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { pipe } from 'effect';
import { ResponseError } from '@effect/platform/HttpClientError';

const runViewCleanup = Effect.fn((dbName: string) => pipe(
  HttpClientRequest.post(`/${dbName}/_view_cleanup`),
  ChtClientService.request,
  Effect.andThen(Effect.void),
  Effect.scoped,
));

const runNouveauCleanup = Effect.fn((dbName: string) => pipe(
  HttpClientRequest.post(`/${dbName}/_nouveau_cleanup`),
  ChtClientService.request,
  Effect.andThen(Effect.void),
  Effect.catchIf(
    (error) => error instanceof ResponseError && error.response.status === 415,
    () => Effect.void,
  ),
  Effect.scoped,
));

export const cleanupDatabaseIndexes = Effect.fn((dbName: string) => Effect.all([
  runViewCleanup(dbName),
  runNouveauCleanup(dbName),
], { concurrency: 'unbounded' }));
