import { Effect, Option, Redacted } from 'effect';
import { FileSystem, HttpClient } from '@effect/platform';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
declare const SSL_URL_DICT: {
    "local-ip": string[][];
    expired: string[][];
    "self-signed": string[][];
};
export type SSLType = keyof typeof SSL_URL_DICT;
export interface LocalChtInstance {
    name: string;
    username: string;
    password: Redacted.Redacted;
    status: 'running' | 'stopped';
    port: Option.Option<`${number}`>;
}
declare const LocalInstanceService_base: Effect.Service.Class<LocalInstanceService, "chtoolbox/LocalInstanceService", {
    readonly effect: Effect.Effect<{
        create: (instanceName: string, version: string, localVolumePath: Option.Option<string>) => Effect.Effect<void, Error, never>;
        start: (instanceName: string, localVolumePath: Option.Option<string>) => Effect.Effect<LocalChtInstance, Error, never>;
        stop: (instanceName: string) => Effect.Effect<void, Error, never>;
        rm: (instanceName: string) => Effect.Effect<void, Error, never>;
        setSSLCerts: (instanceName: string, sslType: "expired" | "local-ip" | "self-signed") => Effect.Effect<void, Error, never>;
        ls: () => Effect.Effect<LocalChtInstance[], Error, never>;
    }, never, CommandExecutor | FileSystem.FileSystem | HttpClient.HttpClient>;
    readonly accessors: true;
}>;
export declare class LocalInstanceService extends LocalInstanceService_base {
}
export {};
//# sourceMappingURL=local-instance.d.ts.map