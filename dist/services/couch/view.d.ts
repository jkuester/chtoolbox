import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect } from './couch';
declare const CouchView_base: Schema.Class<CouchView, {
    total_rows: Schema.UndefinedOr<typeof Schema.Number>;
}, Schema.Struct.Encoded<{
    total_rows: Schema.UndefinedOr<typeof Schema.Number>;
}>, never, {
    readonly total_rows: number | undefined;
}, {}, {}>;
export declare class CouchView extends CouchView_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<CouchView, import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchViewService {
    readonly warm: (dbName: string, designName: string, viewName: string) => CouchResponseEffect<CouchView>;
}
export declare const CouchViewService: Context.Tag<CouchViewService, CouchViewService>;
export declare const CouchViewServiceLive: Layer.Layer<CouchViewService, never, never>;
export {};
//# sourceMappingURL=view.d.ts.map