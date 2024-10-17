import * as Effect from 'effect/Effect';
import { CouchService } from './couch';
declare const CouchCompactService_base: Effect.Service.Class<CouchCompactService, "chtoolbox/CouchCompactService", {
    readonly effect: Effect.Effect<{
        compactDb: (dbName: string, designName?: string) => Effect.Effect<void, Error, never>;
        compactDesign: (dbName: string, designName?: string) => Effect.Effect<void, Error, never>;
    }, never, CouchService>;
    readonly accessors: true;
}>;
export declare class CouchCompactService extends CouchCompactService_base {
}
export {};
//# sourceMappingURL=compact.d.ts.map