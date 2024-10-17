import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import { CouchService } from './couch';
declare const CouchNodeSystem_base: Schema.Class<CouchNodeSystem, {
    memory: Schema.Struct<{
        processes_used: typeof Schema.Number;
        binary: typeof Schema.Number;
    }>;
}, Schema.Struct.Encoded<{
    memory: Schema.Struct<{
        processes_used: typeof Schema.Number;
        binary: typeof Schema.Number;
    }>;
}>, never, {
    readonly memory: {
        readonly processes_used: number;
        readonly binary: number;
    };
}, {}, {}>;
export declare class CouchNodeSystem extends CouchNodeSystem_base {
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<CouchNodeSystem, import("@effect/schema/ParseResult").ParseError | E, never>;
}
declare const CouchNodeSystemService_base: Effect.Service.Class<CouchNodeSystemService, "chtoolbox/CouchNodeSystemService", {
    readonly effect: Effect.Effect<{
        get: () => Effect.Effect<CouchNodeSystem, Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, never>;
    }, never, CouchService>;
    readonly accessors: true;
}>;
export declare class CouchNodeSystemService extends CouchNodeSystemService_base {
}
export {};
//# sourceMappingURL=node-system.d.ts.map