import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
declare const CouchNodeSystem_base: Schema.Class<CouchNodeSystem, {
    memory: Schema.Struct<{
        other: typeof Schema.Number;
        atom: typeof Schema.Number;
    }>;
}, Schema.Struct.Encoded<{
    memory: Schema.Struct<{
        other: typeof Schema.Number;
        atom: typeof Schema.Number;
    }>;
}>, never, {
    readonly memory: {
        readonly other: number;
        readonly atom: number;
    };
}, {}, {}>;
export declare class CouchNodeSystem extends CouchNodeSystem_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<CouchNodeSystem, import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchNodeSystemService {
    readonly get: () => Effect.Effect<CouchNodeSystem, Error>;
}
export declare const CouchNodeSystemService: Context.Tag<CouchNodeSystemService, CouchNodeSystemService>;
export declare const CouchNodeSystemServiceLive: Layer.Layer<CouchNodeSystemService, Error, never>;
export {};
//# sourceMappingURL=node-system.d.ts.map