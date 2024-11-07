import * as Effect from 'effect/Effect';
import { Stream } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
import { CouchActiveTasksService } from './couch/active-tasks';
declare const CompactService_base: Effect.Service.Class<CompactService, "chtoolbox/CompactService", {
    readonly effect: Effect.Effect<{
        compactAll: (compactDesigns: boolean) => Effect.Effect<Stream.Stream<import("./couch/active-tasks").CouchActiveTask[], Error, never>, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, never>;
        compactDb: (dbName: string, compactDesigns: boolean) => Effect.Effect<Stream.Stream<import("./couch/active-tasks").CouchActiveTask[], Error, never>, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, never>;
        compactDesign: (dbName: string) => (designName: string) => Effect.Effect<Stream.Stream<import("./couch/active-tasks").CouchActiveTask[], Error, never>, Error, never>;
    }, never, CouchDbsInfoService | CouchDesignInfoService | CouchDesignDocsService | CouchCompactService | CouchActiveTasksService>;
    readonly accessors: true;
}>;
export declare class CompactService extends CompactService_base {
}
export {};
//# sourceMappingURL=compact.d.ts.map