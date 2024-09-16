import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Config, Layer, Redacted, Ref, Scope } from 'effect';

export interface CouchService {
  readonly request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    Error,
    Scope.Scope
  >
}

export const CouchService = Context.GenericTag<CouchService>('chtoolbox/CouchService');

const getHttpClient = HttpClient.HttpClient.pipe(
  Effect.map(HttpClient.filterStatusOk)
);

const getCouchRequest2 = (url: Ref.Ref<Config.Config<Redacted.Redacted>>) => url.pipe(
  Ref.get,
  Effect.map(Config.map(Redacted.value)),
  Effect.flatMap(Config.map(url => HttpClientRequest.prependUrl(url))),
  Effect.map(req => HttpClient.mapRequest(req)),
);

const createCouchService = EnvironmentService.pipe(
  Effect.flatMap((env) => getHttpClient.pipe(
    Effect.map(httpClient => CouchService.of({
      request: (request: HttpClientRequest.HttpClientRequest) => env.url.pipe(
        getCouchRequest2,
        Effect.map(req => req(httpClient)),
        Effect.flatMap(client => client(request)),
        Effect.mapError(x => x as Error)
      )
    }))
  ))
);

export const CouchServiceLive = Layer
  .effect(CouchService, createCouchService);
