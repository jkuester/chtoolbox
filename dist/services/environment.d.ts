import { Effect, Redacted } from 'effect';
export interface Environment {
    readonly url: Redacted.Redacted;
    readonly user: string;
}
declare const EnvironmentService_base: Effect.Service.Class<EnvironmentService, "chtoolbox/EnvironmentService", {
    readonly effect: Effect.Effect<{
        get: () => Effect.Effect<Environment>;
        setUrl: (url: Redacted.Redacted) => Effect.Effect<Environment, Error>;
    }, Error | import("effect/ConfigError").ConfigError, never>;
    readonly accessors: true;
}>;
export declare class EnvironmentService extends EnvironmentService_base {
}
export {};
//# sourceMappingURL=environment.d.ts.map