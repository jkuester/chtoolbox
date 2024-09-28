import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
declare const CouchDesignInfo_base: Schema.Class<CouchDesignInfo, {
    name: typeof Schema.String;
    view_index: Schema.Struct<{
        compact_running: typeof Schema.Boolean;
        updater_running: typeof Schema.Boolean;
        sizes: Schema.Struct<{
            file: typeof Schema.Number;
            active: typeof Schema.Number;
        }>;
    }>;
}, Schema.Struct.Encoded<{
    name: typeof Schema.String;
    view_index: Schema.Struct<{
        compact_running: typeof Schema.Boolean;
        updater_running: typeof Schema.Boolean;
        sizes: Schema.Struct<{
            file: typeof Schema.Number;
            active: typeof Schema.Number;
        }>;
    }>;
}>, never, {
    readonly name: string;
} & {
    readonly view_index: {
        readonly sizes: {
            readonly file: number;
            readonly active: number;
        };
        readonly compact_running: boolean;
        readonly updater_running: boolean;
    };
}, {}, {}>;
export declare class CouchDesignInfo extends CouchDesignInfo_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<CouchDesignInfo, import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchDesignInfoService {
    readonly get: (dbName: string, designName: string) => Effect.Effect<CouchDesignInfo, Error>;
}
export declare const CouchDesignInfoService: Context.Tag<CouchDesignInfoService, CouchDesignInfoService>;
export declare const CouchDesignInfoServiceLive: Layer.Layer<CouchDesignInfoService, never, CouchService>;
export {};
//# sourceMappingURL=design-info.d.ts.map