import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Layer, pipe, Redacted, Scope } from 'effect';

export interface CouchService {
  readonly request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    Error,
    Scope.Scope
  >
}

export const CouchService = Context.GenericTag<CouchService>('chtoolbox/CouchService');

const couchUrl = EnvironmentService.pipe(
  Effect.flatMap(service => service.get()),
  Effect.map(({ url }) => url),
);

const clientWithUrl = couchUrl.pipe(
  Effect.flatMap(url => HttpClient.HttpClient.pipe(
    Effect.map(HttpClient.filterStatusOk),
    Effect.map(HttpClient.mapRequest(HttpClientRequest.prependUrl(Redacted.value(url)))),
  )),
);

const ServiceContext = Effect
  .all([
    EnvironmentService,
    HttpClient.HttpClient,
  ])
  .pipe(Effect.map(([env, client]) => Context
    .make(EnvironmentService, env)
    .pipe(Context.add(HttpClient.HttpClient, client))));

export const CouchServiceLive = Layer.effect(CouchService, ServiceContext.pipe(Effect.map(
  context => CouchService.of({
    request: (request: HttpClientRequest.HttpClientRequest) => pipe(
      clientWithUrl,
      Effect.flatMap(client => client(request)),
      Effect.mapError(x => x as Error),
      Effect.provide(context),
    )
  })
)));
