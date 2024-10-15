import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
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
declare const CouchDesignDocsService_base: Effect.Service.Class<CouchDesignDocsService, "chtoolbox/CouchDesignDocsService", {
    readonly effect: Effect.Effect<{
        getNames: (dbName: string) => Effect.Effect<string[], Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, never>;
    }, never, CouchService>;
    readonly accessors: true;
}>;
export declare class CouchDesignDocsService extends CouchDesignDocsService_base {
}
export {};
//# sourceMappingURL=design-docs.d.ts.map