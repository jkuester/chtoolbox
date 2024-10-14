import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
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
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<CouchDesignDocs, import("@effect/schema/ParseResult").ParseError | E, never>;
}
export interface CouchDesignDocsService {
    readonly getNames: (dbName: string) => Effect.Effect<readonly string[], Error>;
}
export declare const CouchDesignDocsService: Context.Tag<CouchDesignDocsService, CouchDesignDocsService>;
export declare const CouchDesignDocsServiceLive: Layer.Layer<CouchDesignDocsService, never, CouchService>;
export {};
//# sourceMappingURL=design-docs.d.ts.map