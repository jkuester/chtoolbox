import * as Effect from 'effect/Effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignService } from './couch/design';
import { CouchViewService } from './couch/view';
import { CouchDesignInfoService } from './couch/design-info';
declare const WarmViewsService_base: Effect.Service.Class<WarmViewsService, "chtoolbox/WarmViewsService", {
    readonly effect: Effect.Effect<{
        warmAll: () => Effect.Effect<void[], Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, never>;
        designsCurrentlyUpdating: () => Effect.Effect<{
            dbName: string;
            designId: string;
        }[], Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, never>;
    }, never, CouchDbsInfoService | CouchDesignInfoService | CouchDesignService | CouchViewService | CouchDesignDocsService>;
    readonly accessors: true;
}>;
export declare class WarmViewsService extends WarmViewsService_base {
}
export {};
//# sourceMappingURL=warm-views.d.ts.map