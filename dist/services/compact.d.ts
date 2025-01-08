import * as Effect from 'effect/Effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignInfoService } from './couch/design-info';
import { CouchActiveTasksService, CouchActiveTaskStream } from './couch/active-tasks';
import { ChtClientService } from './cht-client';
declare const CompactService_base: Effect.Service.Class<CompactService, "chtoolbox/CompactService", {
    readonly effect: Effect.Effect<{
        compactAll: (compactDesigns: boolean) => Effect.Effect<CouchActiveTaskStream, Error>;
        compactDb: (dbName: string, compactDesigns: boolean) => Effect.Effect<CouchActiveTaskStream, Error>;
        compactDesign: (dbName: string) => (designName: string) => Effect.Effect<CouchActiveTaskStream, Error>;
    }, never, ChtClientService | CouchDbsInfoService | CouchDesignInfoService | CouchDesignDocsService | CouchActiveTasksService>;
    readonly accessors: true;
}>;
export declare class CompactService extends CompactService_base {
}
export {};
//# sourceMappingURL=compact.d.ts.map