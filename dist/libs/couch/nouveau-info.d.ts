import { Schema } from 'effect';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';
declare const NouveauInfo_base: Schema.Class<NouveauInfo, {
    name: typeof Schema.String;
    search_index: Schema.Struct<{
        update_seq: typeof Schema.Number;
        purge_seq: typeof Schema.Number;
        num_docs: typeof Schema.Number;
        disk_size: typeof Schema.Number;
    }>;
}, Schema.Struct.Encoded<{
    name: typeof Schema.String;
    search_index: Schema.Struct<{
        update_seq: typeof Schema.Number;
        purge_seq: typeof Schema.Number;
        num_docs: typeof Schema.Number;
        disk_size: typeof Schema.Number;
    }>;
}>, never, {
    readonly name: string;
} & {
    readonly search_index: {
        readonly update_seq: number;
        readonly purge_seq: number;
        readonly num_docs: number;
        readonly disk_size: number;
    };
}, {}, {}>;
export declare class NouveauInfo extends NouveauInfo_base {
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<NouveauInfo, import("effect/ParseResult").ParseError | E, never>;
}
export declare const getNouveauInfo: (dbName: string, ddocName: string, indexName: string) => Effect.Effect<NouveauInfo, Error, ChtClientService>;
export {};
//# sourceMappingURL=nouveau-info.d.ts.map