import { EnvironmentService } from './environment';
import { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import { Scope } from 'effect/Scope';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
declare const ChtClientService_base: Effect.Service.Class<ChtClientService, "chtoolbox/ChtClientService", {
    readonly effect: Effect.Effect<{
        request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientResponse, Error, Scope>;
    }, never, EnvironmentService | HttpClient.HttpClient<import("@effect/platform/HttpClientError").HttpClientError, Scope>>;
    readonly accessors: true;
}>;
export declare class ChtClientService extends ChtClientService_base {
}
export {};
//# sourceMappingURL=cht-client.d.ts.map