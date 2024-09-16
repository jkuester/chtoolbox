import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Layer, Ref, Scope } from 'effect';

export interface CouchService {
  readonly request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError,
    Scope.Scope
  >
}

export const CouchService = Context.GenericTag<CouchService>('chtoolbox/CouchService');

const getHttpClient = HttpClient.HttpClient.pipe(
  Effect.map(HttpClient.filterStatusOk)
);

const getCouchRequest2 = (url: Ref.Ref<string>) => url.pipe(
  Ref.get,
  Effect.map(url => HttpClientRequest.prependUrl(url)),
  Effect.map(req => HttpClient.mapRequest(req)),
);

const createCouchService = EnvironmentService.pipe(
  Effect.flatMap((env) => getHttpClient.pipe(
    Effect.map(httpClient => CouchService.of({
      request: (request: HttpClientRequest.HttpClientRequest) => env.url.pipe(
        getCouchRequest2,
        Effect.map(req => req(httpClient)),
        x => x,
        Effect.flatMap(client => client(request)),
        x => x
      )
    }))
  ))
);

export const CouchServiceLive = Layer
  .effect(CouchService, createCouchService);
