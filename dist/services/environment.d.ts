import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Effect, Redacted } from 'effect';
export interface Environment {
    readonly url: Redacted.Redacted;
    readonly user: string;
}
export interface EnvironmentService {
    readonly get: () => Effect.Effect<Environment>;
    readonly setUrl: (url: Redacted.Redacted) => Effect.Effect<Environment>;
}
export declare const EnvironmentService: Context.Tag<EnvironmentService, EnvironmentService>;
export declare const EnvironmentServiceLive: Layer.Layer<EnvironmentService, import("effect/ConfigError").ConfigError, never>;
//# sourceMappingURL=environment.d.ts.map