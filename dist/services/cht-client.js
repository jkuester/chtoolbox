import { EnvironmentService } from "./environment.js";
import { Scope } from 'effect/Scope';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import * as Context from 'effect/Context';
import { pipe, Redacted } from 'effect';
import { filterStatusOk, mapRequest } from '@effect/platform/HttpClient';
const couchUrl = pipe(EnvironmentService.get(), Effect.map(({ url }) => url), Effect.map(Redacted.value));
const getClientForUrl = Effect.fn((url) => pipe(HttpClient.HttpClient, Effect.map(mapRequest(HttpClientRequest.prependUrl(url)))));
const clientWithUrl = pipe(couchUrl, Effect.flatMap(getClientForUrl), Effect.map(filterStatusOk));
const serviceContext = Effect
    .all([
    EnvironmentService,
    HttpClient.HttpClient,
])
    .pipe(Effect.map(([env, client]) => Context
    .make(EnvironmentService, env)
    .pipe(Context.add(HttpClient.HttpClient, client))));
export class ChtClientService extends Effect.Service()('chtoolbox/ChtClientService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        request: Effect.fn((request) => clientWithUrl.pipe(Effect.flatMap(client => client.execute(request)), Effect.mapError(x => x), Effect.provide(context))),
    }))),
    accessors: true,
}) {
}
