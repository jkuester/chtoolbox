import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Ref } from 'effect';
export interface EnvironmentService {
    readonly url: Ref.Ref<string>;
}
export declare const EnvironmentService: Context.Tag<EnvironmentService, EnvironmentService>;
export declare const EnvironmentServiceLive: Layer.Layer<EnvironmentService, import("effect/ConfigError").ConfigError, never>;
//# sourceMappingURL=environment.d.ts.map