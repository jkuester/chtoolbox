import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
declare const CouchDesignInfo_base: Schema.Class<CouchDesignInfo, {
    name: typeof Schema.String;
    view_index: Schema.Struct<{
        collator_versions: Schema.Array$<typeof Schema.String>;
        compact_running: typeof Schema.Boolean;
        language: typeof Schema.String;
        purge_seq: typeof Schema.Number;
        signature: typeof Schema.String;
        sizes: Schema.Struct<{
            active: typeof Schema.Number;
            external: typeof Schema.Number;
            file: typeof Schema.Number;
        }>;
        updater_running: typeof Schema.Boolean;
        updates_pending: Schema.Struct<{
            minimum: typeof Schema.Number;
            preferred: typeof Schema.Number;
            total: typeof Schema.Number;
        }>;
        waiting_commit: typeof Schema.Boolean;
        waiting_clients: typeof Schema.Number;
    }>;
}, Schema.Struct.Encoded<{
    name: typeof Schema.String;
    view_index: Schema.Struct<{
        collator_versions: Schema.Array$<typeof Schema.String>;
        compact_running: typeof Schema.Boolean;
        language: typeof Schema.String;
        purge_seq: typeof Schema.Number;
        signature: typeof Schema.String;
        sizes: Schema.Struct<{
            active: typeof Schema.Number;
            external: typeof Schema.Number;
            file: typeof Schema.Number;
        }>;
        updater_running: typeof Schema.Boolean;
        updates_pending: Schema.Struct<{
            minimum: typeof Schema.Number;
            preferred: typeof Schema.Number;
            total: typeof Schema.Number;
        }>;
        waiting_commit: typeof Schema.Boolean;
        waiting_clients: typeof Schema.Number;
    }>;
}>, never, {
    readonly name: string;
} & {
    readonly view_index: {
        readonly sizes: {
            readonly file: number;
            readonly external: number;
            readonly active: number;
        };
        readonly purge_seq: number;
        readonly compact_running: boolean;
        readonly collator_versions: readonly string[];
        readonly language: string;
        readonly signature: string;
        readonly updater_running: boolean;
        readonly updates_pending: {
            readonly minimum: number;
            readonly preferred: number;
            readonly total: number;
        };
        readonly waiting_commit: boolean;
        readonly waiting_clients: number;
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