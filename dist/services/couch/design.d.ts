import * as Effect from 'effect/Effect';
import { CouchService } from './couch';
declare const CouchDesignService_base: Effect.Service.Class<CouchDesignService, "chtoolbox/CouchDesignService", {
    readonly effect: Effect.Effect<{
        getViewNames: (dbName: string, designName: string) => Effect.Effect<string[], Error>;
    }, never, CouchService>;
    readonly accessors: true;
}>;
export declare class CouchDesignService extends CouchDesignService_base {
}
export {};
//# sourceMappingURL=design.d.ts.map