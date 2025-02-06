import { Effect, Option, Redacted } from 'effect';
import { FileSystem, HttpClient } from '@effect/platform';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
declare const SSL_URL_DICT: {
    'local-ip': string[][];
    expired: string[][];
    'self-signed': string[][];
};
export type SSLType = keyof typeof SSL_URL_DICT;
export interface LocalChtInstance {
    name: string;
    username: string;
    password: Redacted.Redacted;
    port: Option.Option<`${number}`>;
}
declare const LocalInstanceService_base: Effect.Service.Class<LocalInstanceService, "chtoolbox/LocalInstanceService", {
    readonly effect: Effect.Effect<{
        create: (instanceName: string, version: string) => Effect.Effect<void, Error>;
        start: (instanceName: string) => Effect.Effect<LocalChtInstance, Error>;
        stop: (instanceName: string) => Effect.Effect<void, Error>;
        rm: (instanceName: string) => Effect.Effect<void, Error>;
        setSSLCerts: (instanceName: string, sslType: SSLType) => Effect.Effect<void, Error>;
        ls: () => Effect.Effect<LocalChtInstance[], Error>;
    }, never, HttpClient.HttpClient | CommandExecutor | FileSystem.FileSystem>;
    readonly accessors: true;
}>;
export declare class LocalInstanceService extends LocalInstanceService_base {
}
export {};
//# sourceMappingURL=local-instance.d.ts.map