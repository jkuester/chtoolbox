import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Layer, Scope } from 'effect';
export interface CouchService {
    readonly request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientResponse.HttpClientResponse, Error, Scope.Scope>;
}
export declare const CouchService: Context.Tag<CouchService, CouchService>;
export declare const CouchServiceLive: Layer.Layer<CouchService, never, EnvironmentService | HttpClient.HttpClient<import("@effect/platform/HttpClientError").HttpClientError, Scope.Scope>>;
//# sourceMappingURL=couch.d.ts.map