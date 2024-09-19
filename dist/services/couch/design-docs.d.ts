import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect } from './couch';
declare const CouchDesignDocs_base: Schema.Class<CouchDesignDocs, {
    rows: Schema.Array$<Schema.Struct<{
        id: typeof Schema.String;
    }>>;
}, Schema.Struct.Encoded<{
    rows: Schema.Array$<Schema.Struct<{
        id: typeof Schema.String;
    }>>;
}>, never, {
    readonly rows: readonly {
        readonly id: string;
    }[];
}, {}, {}>;
export declare class CouchDesignDocs extends CouchDesignDocs_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<CouchDesignDocs, import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchDesignDocsService {
    readonly getNames: (dbName: string) => CouchResponseEffect<readonly string[]>;
}
export declare const CouchDesignDocsService: Context.Tag<CouchDesignDocsService, CouchDesignDocsService>;
export declare const CouchDesignDocsServiceLive: Layer.Layer<CouchDesignDocsService, never, never>;
export {};
//# sourceMappingURL=design-docs.d.ts.map