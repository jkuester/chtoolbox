import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Config, Layer, Redacted, Ref, Scope } from 'effect';

export interface CouchResponseEffect<A, E = never, R = never> extends Effect.Effect<
  A,
  E | Error,
  R | EnvironmentService | HttpClient.HttpClient.Default | CouchService
> {
}

export interface CouchService {
  readonly request: (request: HttpClientRequest.HttpClientRequest) => CouchResponseEffect<
    HttpClientResponse.HttpClientResponse,
    never,
    Scope.Scope
  >
}

export const CouchService = Context.GenericTag<CouchService>('chtoolbox/CouchService');

const getCouchUrl = EnvironmentService.pipe(
  Effect.map(env => env.url),
  Effect.flatMap(Ref.get),
  Effect.map(Config.map(Redacted.value)),
);

const getClientWithUrl = getCouchUrl.pipe(
  Effect.flatMap(Config.map(url => HttpClient.HttpClient.pipe(
    Effect.map(HttpClient.filterStatusOk),
    Effect.map(HttpClient.mapRequest(HttpClientRequest.prependUrl(url))),
  ))),
  Effect.flatten,
);

export const CouchServiceLive = Layer.succeed(CouchService, CouchService.of({
  request: (request: HttpClientRequest.HttpClientRequest) => getClientWithUrl.pipe(
    Effect.flatMap(client => client(request)),
    Effect.mapError(x => x as Error),
  )
}));
