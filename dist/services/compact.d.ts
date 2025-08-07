import * as Effect from 'effect/Effect';
import { type CouchActiveTaskStream } from '../libs/couch/active-tasks.ts';
import { ChtClientService } from './cht-client.ts';
declare const CompactService_base: Effect.Service.Class<CompactService, "chtoolbox/CompactService", {
    readonly effect: Effect.Effect<{
        compactAll: (compactDesigns: boolean) => Effect.Effect<CouchActiveTaskStream, Error, never>;
        compactDb: (dbName: string, compactDesigns: boolean) => Effect.Effect<CouchActiveTaskStream, Error, never>;
        compactDesign: (dbName: string) => (designName: string) => Effect.Effect<CouchActiveTaskStream, Error, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CompactService extends CompactService_base {
}
export {};
//# sourceMappingURL=compact.d.ts.map