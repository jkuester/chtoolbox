import { Effect, Option } from 'effect';
import { FileSystem, HttpClient } from '@effect/platform';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
declare const SSL_URL_DICT: {
    'local-ip': string[][];
    expired: string[][];
    'self-signed': string[][];
};
export type SSLType = keyof typeof SSL_URL_DICT;
declare const LocalInstanceService_base: Effect.Service.Class<LocalInstanceService, "chtoolbox/LocalInstanceService", {
    readonly effect: Effect.Effect<{
        create: (instanceName: string, version: string) => Effect.Effect<void, Error>;
        start: (instanceName: string) => Effect.Effect<`${number}`, Error>;
        stop: (instanceName: string) => Effect.Effect<void, Error>;
        rm: (instanceName: string) => Effect.Effect<void, Error>;
        setSSLCerts: (instanceName: string, sslType: SSLType) => Effect.Effect<void, Error>;
        ls: () => Effect.Effect<{
            name: string;
            port: Option.Option<`${number}`>;
        }[], Error>;
    }, never, HttpClient.HttpClient<import("@effect/platform/HttpClientError").HttpClientError, import("effect/Scope").Scope> | CommandExecutor | FileSystem.FileSystem>;
    readonly accessors: true;
}>;
export declare class LocalInstanceService extends LocalInstanceService_base {
}
export {};
//# sourceMappingURL=local-instance.d.ts.map