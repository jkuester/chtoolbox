import * as Effect from 'effect/Effect';
import { CouchActiveTaskStream } from '../libs/couch/active-tasks.js';
import { ChtClientService } from './cht-client.js';
declare const CompactService_base: Effect.Service.Class<CompactService, "chtoolbox/CompactService", {
    readonly effect: Effect.Effect<{
        compactAll: (compactDesigns: boolean) => Effect.Effect<CouchActiveTaskStream, Error>;
        compactDb: (dbName: string, compactDesigns: boolean) => Effect.Effect<CouchActiveTaskStream, Error>;
        compactDesign: (dbName: string) => (designName: string) => Effect.Effect<CouchActiveTaskStream, Error>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CompactService extends CompactService_base {
}
export {};
//# sourceMappingURL=compact.d.ts.map