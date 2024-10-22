import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
declare const CouchViewService_base: Effect.Service.Class<CouchViewService, "chtoolbox/CouchViewService", {
    readonly effect: Effect.Effect<{
        warm: (dbName: string, designName: string, viewName: string) => Effect.Effect<void, Error, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CouchViewService extends CouchViewService_base {
}
export {};
//# sourceMappingURL=view.d.ts.map