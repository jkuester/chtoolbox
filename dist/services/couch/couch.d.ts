import { EnvironmentService } from '../environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Context from 'effect/Context';
import { Layer, Scope } from 'effect';
export interface CouchService {
    readonly request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError, Scope.Scope>;
}
export declare const CouchService: Context.Tag<CouchService, CouchService>;
export declare const CouchServiceLive: Layer.Layer<CouchService, never, EnvironmentService | HttpClient.HttpClient.Default>;
//# sourceMappingURL=couch.d.ts.map