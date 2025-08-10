import { EnvironmentService } from "./environment.js";
import { Scope } from 'effect/Scope';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
import * as Context from 'effect/Context';
import { Redacted } from 'effect';
import { filterStatusOk, mapRequest } from '@effect/platform/HttpClient';
const couchUrl = EnvironmentService
    .get()
    .pipe(Effect.map(({ url }) => url));
const clientWithUrl = couchUrl.pipe(Effect.flatMap(url => HttpClient.HttpClient.pipe(Effect.map(filterStatusOk), Effect.map(mapRequest(HttpClientRequest.prependUrl(Redacted.value(url)))))));
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
