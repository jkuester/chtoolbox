import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import { Scope } from 'effect/Scope';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import * as Context from 'effect/Context';
import { Function, Match, pipe, Redacted, Tuple } from 'effect';
import { filterStatusOk, mapRequest } from '@effect/platform/HttpClient';
import { CHT_PASSWORD, CHT_URL, CHT_USERNAME } from '../libs/config.js';
import { RequestError } from '@effect/platform/HttpClientError';

const basicAuthHeaderEffect = pipe(
  Tuple.make(CHT_USERNAME, CHT_PASSWORD),
  Effect.allWith({ concurrency: 'unbounded' }),
  Effect.map(([user, pass]) => `${user}:${Redacted.value(pass)}`),
  Effect.map(creds => Buffer
    .from(creds)
    .toString('base64')),
  Effect.map(encoded => `Basic ${encoded}`),
);

const getClientForUrl = Effect.fn((url: URL, authHeader: string) => pipe(
  HttpClient.HttpClient,
  Effect.map(mapRequest(HttpClientRequest.prependUrl(url.toString()))),
  Effect.map(mapRequest(HttpClientRequest.setHeader('Authorization', authHeader)))
));

const clientWithUrl = pipe(
  Effect.all([CHT_URL, basicAuthHeaderEffect], { concurrency: 'unbounded' }),
  Effect.flatMap(Function.tupled(getClientForUrl)),
  Effect.map(filterStatusOk),
);

const serviceContext = pipe(
  HttpClient.HttpClient,
  Effect.map((client) => Context.make(HttpClient.HttpClient, client))
);

const sanitizeRequestError = (err: RequestError) => ({
  ...err,
  request: {
    ...err.request,
    headers: {
      ...err.request.headers,
      authorization: 'REDACTED',
    },
  },
} as unknown as Error);

export class ChtClientService extends Effect.Service<ChtClientService>()('chtoolbox/ChtClientService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    request: Effect.fn((
      request: HttpClientRequest.HttpClientRequest
    ): Effect.Effect<HttpClientResponse, Error, Scope> => clientWithUrl.pipe(
      Effect.flatMap(client => client.execute(request)),
      x => x,
      Effect.mapError(err => pipe(
        Match.value(err),
        Match.when(Match.instanceOf(RequestError), sanitizeRequestError),
        Match.orElse(err => err as Error)
      )),
      Effect.provide(context),
    )),
  }))),
  accessors: true,
}) {
}
