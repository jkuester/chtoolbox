import { Schema } from 'effect';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
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
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<CouchDesignInfo, import("effect/ParseResult").ParseError | E, never>;
}
declare const CouchDesignInfoService_base: Effect.Service.Class<CouchDesignInfoService, "chtoolbox/CouchDesignInfoService", {
    readonly effect: Effect.Effect<{
        get: (dbName: string, designName: string) => Effect.Effect<CouchDesignInfo, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CouchDesignInfoService extends CouchDesignInfoService_base {
}
export {};
//# sourceMappingURL=design-info.d.ts.map