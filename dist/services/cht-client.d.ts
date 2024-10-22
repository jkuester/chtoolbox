import { EnvironmentService } from './environment';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
declare const ChtClientService_base: Effect.Service.Class<ChtClientService, "chtoolbox/ChtClientService", {
    readonly effect: Effect.Effect<{
        request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<import("@effect/platform/HttpClientResponse").HttpClientResponse, Error, import("effect/Scope").Scope>;
    }, never, EnvironmentService | HttpClient.HttpClient<import("@effect/platform/HttpClientError").HttpClientError, import("effect/Scope").Scope>>;
    readonly accessors: true;
}>;
export declare class ChtClientService extends ChtClientService_base {
}
export {};
//# sourceMappingURL=cht-client.d.ts.map