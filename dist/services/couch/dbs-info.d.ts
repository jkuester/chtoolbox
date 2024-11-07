import * as Effect from 'effect/Effect';
import { Schema } from 'effect';
import { ChtClientService } from '../cht-client';
import { NonEmptyArray } from 'effect/Array';
declare const CouchDbInfo_base: Schema.Class<CouchDbInfo, {
    key: typeof Schema.String;
    info: Schema.Struct<{
        db_name: typeof Schema.String;
        update_seq: typeof Schema.String;
        sizes: Schema.Struct<{
            file: typeof Schema.Number;
            external: typeof Schema.Number;
            active: typeof Schema.Number;
        }>;
        purge_seq: typeof Schema.String;
        doc_del_count: typeof Schema.Number;
        doc_count: typeof Schema.Number;
        disk_format_version: typeof Schema.Number;
        compact_running: typeof Schema.Boolean;
        cluster: Schema.Struct<{
            q: typeof Schema.Number;
            n: typeof Schema.Number;
            w: typeof Schema.Number;
            r: typeof Schema.Number;
        }>;
        instance_start_time: typeof Schema.String;
    }>;
}, Schema.Struct.Encoded<{
    key: typeof Schema.String;
    info: Schema.Struct<{
        db_name: typeof Schema.String;
        update_seq: typeof Schema.String;
        sizes: Schema.Struct<{
            file: typeof Schema.Number;
            external: typeof Schema.Number;
            active: typeof Schema.Number;
        }>;
        purge_seq: typeof Schema.String;
        doc_del_count: typeof Schema.Number;
        doc_count: typeof Schema.Number;
        disk_format_version: typeof Schema.Number;
        compact_running: typeof Schema.Boolean;
        cluster: Schema.Struct<{
            q: typeof Schema.Number;
            n: typeof Schema.Number;
            w: typeof Schema.Number;
            r: typeof Schema.Number;
        }>;
        instance_start_time: typeof Schema.String;
    }>;
}>, never, {
    readonly key: string;
} & {
    readonly info: {
        readonly db_name: string;
        readonly update_seq: string;
        readonly sizes: {
            readonly file: number;
            readonly external: number;
            readonly active: number;
        };
        readonly purge_seq: string;
        readonly doc_del_count: number;
        readonly doc_count: number;
        readonly disk_format_version: number;
        readonly compact_running: boolean;
        readonly cluster: {
            readonly q: number;
            readonly n: number;
            readonly w: number;
            readonly r: number;
        };
        readonly instance_start_time: string;
    };
}, {}, {}>;
export declare class CouchDbInfo extends CouchDbInfo_base {
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<readonly CouchDbInfo[], import("effect/ParseResult").ParseError | E, never>;
}
declare const CouchDbsInfoService_base: Effect.Service.Class<CouchDbsInfoService, "chtoolbox/CouchDbsInfoService", {
    readonly effect: Effect.Effect<{
        post: (dbNames: NonEmptyArray<string>) => Effect.Effect<readonly CouchDbInfo[], Error>;
        get: () => Effect.Effect<readonly CouchDbInfo[], Error>;
        getDbNames: () => Effect.Effect<string[], Error>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CouchDbsInfoService extends CouchDbsInfoService_base {
}
export {};
//# sourceMappingURL=dbs-info.d.ts.map