import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect } from './couch';
declare const CouchDbInfo_base: Schema.Class<CouchDbInfo, {
    key: typeof Schema.String;
    info: Schema.Struct<{
        compact_running: typeof Schema.Boolean;
        sizes: Schema.Struct<{
            file: typeof Schema.Number;
            active: typeof Schema.Number;
        }>;
    }>;
}, Schema.Struct.Encoded<{
    key: typeof Schema.String;
    info: Schema.Struct<{
        compact_running: typeof Schema.Boolean;
        sizes: Schema.Struct<{
            file: typeof Schema.Number;
            active: typeof Schema.Number;
        }>;
    }>;
}>, never, {
    readonly key: string;
} & {
    readonly info: {
        readonly compact_running: boolean;
        readonly sizes: {
            readonly file: number;
            readonly active: number;
        };
    };
}, {}, {}>;
export declare class CouchDbInfo extends CouchDbInfo_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<readonly CouchDbInfo[], import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchDbsInfoService {
    readonly post: () => CouchResponseEffect<readonly CouchDbInfo[]>;
    readonly get: () => CouchResponseEffect<readonly CouchDbInfo[]>;
    readonly getDbNames: () => CouchResponseEffect<readonly string[]>;
}
export declare const CouchDbsInfoService: Context.Tag<CouchDbsInfoService, CouchDbsInfoService>;
export declare const CouchDbsInfoServiceLive: Layer.Layer<CouchDbsInfoService, never, never>;
export {};
//# sourceMappingURL=dbs-info.d.ts.map