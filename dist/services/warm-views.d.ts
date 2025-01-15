import * as Effect from 'effect/Effect';
import { ChtClientService } from './cht-client.js';
declare const WarmViewsService_base: Effect.Service.Class<WarmViewsService, "chtoolbox/WarmViewsService", {
    readonly effect: Effect.Effect<{
        warmAll: () => Effect.Effect<void, Error>;
        designsCurrentlyUpdating: () => Effect.Effect<{
            dbName: string;
            designId: string;
        }[], Error>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class WarmViewsService extends WarmViewsService_base {
}
export {};
//# sourceMappingURL=warm-views.d.ts.map