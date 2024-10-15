import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import * as Context from 'effect/Context';
import { pipe, Redacted } from 'effect';

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

const serviceContext = Effect
  .all([
    EnvironmentService,
    HttpClient.HttpClient,
  ])
  .pipe(Effect.map(([env, client]) => Context
    .make(EnvironmentService, env)
    .pipe(Context.add(HttpClient.HttpClient, client))));

export class CouchService extends Effect.Service<CouchService>()('chtoolbox/CouchService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    request: (request: HttpClientRequest.HttpClientRequest) => pipe(
      clientWithUrl,
      Effect.flatMap(client => client.execute(request)),
      Effect.mapError(x => x as Error),
      Effect.provide(context),
    )
  }))),
  accessors: true,
}) {
}

