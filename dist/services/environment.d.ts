import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Config, Redacted, Ref } from 'effect';
export interface Environment {
    readonly url: Ref.Ref<Config.Config<Redacted.Redacted>>;
}
export interface EnvironmentService {
    readonly get: () => Environment;
}
export declare const EnvironmentService: Context.Tag<EnvironmentService, EnvironmentService>;
export declare const EnvironmentServiceLive: Layer.Layer<EnvironmentService, never, never>;
//# sourceMappingURL=environment.d.ts.map