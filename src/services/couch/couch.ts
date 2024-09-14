import { EnvironmentService, EnvironmentServiceLive } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Layer, Scope } from 'effect';
import { NodeHttpClient } from '@effect/platform-node';

export interface CouchService {
  readonly request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError,
    Scope.Scope
  >
}

export const CouchService = Context.GenericTag<CouchService>('chtoolbox/CouchService');

const getEnvironment = EnvironmentService.pipe(
  Effect.map(envService => envService.get()),
);

const getCouchRequest = getEnvironment.pipe(
  Effect.map(({ couchUrl }) => HttpClientRequest.prependUrl(couchUrl)),
  Effect.map(req => HttpClient.mapRequest(req)),
);

const getHttpClient = HttpClient.HttpClient.pipe(
  Effect.map(HttpClient.filterStatusOk)
);

const getCouchClient = Effect
  .all([
    getHttpClient,
    getCouchRequest
  ])
  .pipe(
    Effect.map(([client, request]) => request(client))
  );


const createCouchService = getCouchClient.pipe(
  Effect.map(client => CouchService.of({
    request: (request: HttpClientRequest.HttpClientRequest) => client(request)
  }))
);

export const CouchServiceLive = Layer
  .effect(CouchService, createCouchService)
  // .pipe(
  //   Layer.provide(NodeHttpClient.layer),
  //   Layer.provide(EnvironmentServiceLive)
  // );

