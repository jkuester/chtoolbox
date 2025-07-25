import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';
import { Schema } from 'effect';
declare const CouchDesign_base: Schema.Class<CouchDesign, {
    _id: typeof Schema.String;
    views: Schema.UndefinedOr<typeof Schema.Object>;
    deploy_info: Schema.UndefinedOr<Schema.Struct<{
        user: Schema.UndefinedOr<typeof Schema.String>;
        upgrade_log_id: Schema.UndefinedOr<typeof Schema.String>;
    }>>;
}, Schema.Struct.Encoded<{
    _id: typeof Schema.String;
    views: Schema.UndefinedOr<typeof Schema.Object>;
    deploy_info: Schema.UndefinedOr<Schema.Struct<{
        user: Schema.UndefinedOr<typeof Schema.String>;
        upgrade_log_id: Schema.UndefinedOr<typeof Schema.String>;
    }>>;
}>, never, {
    readonly _id: string;
} & {
    readonly views: object | undefined;
} & {
    readonly deploy_info: {
        readonly user: string | undefined;
        readonly upgrade_log_id: string | undefined;
    } | undefined;
}, {}, {}>;
export declare class CouchDesign extends CouchDesign_base {
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<CouchDesign, import("effect/ParseResult").ParseError | E, never>;
}
export declare const getViewNames: (dbName: string, designName: string) => Effect.Effect<string[], Error, ChtClientService>;
export {};
//# sourceMappingURL=design.d.ts.map