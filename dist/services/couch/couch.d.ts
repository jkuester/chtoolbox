import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Layer, Scope } from 'effect';
export interface CouchResponseEffect<A, E = never, R = never> extends Effect.Effect<A, E | Error, R | EnvironmentService | HttpClient.HttpClient.Default | CouchService> {
}
export interface CouchService {
    readonly request: (request: HttpClientRequest.HttpClientRequest) => CouchResponseEffect<HttpClientResponse.HttpClientResponse, never, Scope.Scope>;
}
export declare const CouchService: Context.Tag<CouchService, CouchService>;
export declare const CouchServiceLive: Layer.Layer<CouchService, never, never>;
//# sourceMappingURL=couch.d.ts.map