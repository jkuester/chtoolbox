import { EnvironmentService } from './environment.ts';
import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import { Scope } from 'effect/Scope';
import * as Effect from 'effect/Effect';
import { HttpClient, HttpClientRequest } from '@effect/platform';
declare const ChtClientService_base: Effect.Service.Class<ChtClientService, "chtoolbox/ChtClientService", {
    readonly effect: Effect.Effect<{
        request: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<HttpClientResponse, Error, Scope>;
    }, never, EnvironmentService | HttpClient.HttpClient>;
    readonly accessors: true;
}>;
export declare class ChtClientService extends ChtClientService_base {
}
export {};
//# sourceMappingURL=cht-client.d.ts.map