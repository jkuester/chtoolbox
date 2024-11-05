import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
declare const CouchDesignDocsService_base: Effect.Service.Class<CouchDesignDocsService, "chtoolbox/CouchDesignDocsService", {
    readonly effect: Effect.Effect<{
        getNames: (dbName: string) => Effect.Effect<string[], Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CouchDesignDocsService extends CouchDesignDocsService_base {
}
export {};
//# sourceMappingURL=design-docs.d.ts.map