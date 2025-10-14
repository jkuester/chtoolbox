import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import { Scope } from 'effect/Scope';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import * as Context from 'effect/Context';
import { pipe, Redacted } from 'effect';
import { filterStatusOk, mapRequest } from '@effect/platform/HttpClient';
import { CHT_URL_AUTHENTICATED } from '../libs/config.js';

const getClientForUrl = Effect.fn((url: URL) => pipe(
  HttpClient.HttpClient,
  Effect.map(mapRequest(HttpClientRequest.prependUrl(url.toString()))),
));

const clientWithUrl = pipe(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  CHT_URL_AUTHENTICATED,
  Effect.map(Redacted.value),
  Effect.flatMap(getClientForUrl),
  Effect.map(filterStatusOk),
);

const serviceContext = pipe(
  HttpClient.HttpClient,
  Effect.map((client) => Context.make(HttpClient.HttpClient, client))
);

export class ChtClientService extends Effect.Service<ChtClientService>()('chtoolbox/ChtClientService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    request: Effect.fn((
      request: HttpClientRequest.HttpClientRequest
    ): Effect.Effect<HttpClientResponse, Error, Scope> => clientWithUrl.pipe(
      Effect.flatMap(client => client.execute(request)),
      Effect.mapError(x => x as Error),
      Effect.provide(context),
    )),
  }))),
  accessors: true,
}) {
}
