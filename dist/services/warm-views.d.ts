import * as Effect from 'effect/Effect';
import { Stream } from 'effect';
import { ChtClientService } from './cht-client.js';
import { CouchActiveTask } from '../libs/couch/active-tasks.js';
declare const WarmViewsService_base: Effect.Service.Class<WarmViewsService, "chtoolbox/WarmViewsService", {
    readonly effect: Effect.Effect<{
        warmAll: () => Effect.Effect<void, Error, never>;
        designsCurrentlyUpdating: () => Effect.Effect<{
            dbName: string;
            designId: string;
        }[], Error, never>;
        warmDesign: (dbName: string, designId: string) => Stream.Stream<CouchActiveTask[], Error, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class WarmViewsService extends WarmViewsService_base {
}
export {};
//# sourceMappingURL=warm-views.d.ts.map