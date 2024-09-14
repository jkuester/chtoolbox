import * as Schema from '@effect/schema/Schema';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
declare const Environment_base: Schema.Class<Environment, {
    couchUrl: typeof Schema.String;
}, Schema.Struct.Encoded<{
    couchUrl: typeof Schema.String;
}>, never, {
    readonly couchUrl: string;
}, {}, {}>;
export declare class Environment extends Environment_base {
}
export interface EnvironmentService {
    readonly get: () => Environment;
}
export declare const EnvironmentService: Context.Tag<EnvironmentService, EnvironmentService>;
export declare const EnvironmentServiceLive: Layer.Layer<EnvironmentService, Error, never>;
export {};
//# sourceMappingURL=environment.d.ts.map