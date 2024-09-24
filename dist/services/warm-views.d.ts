import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignService } from './couch/design';
import { CouchViewService } from './couch/view';
import { CouchDesignInfoService } from './couch/design-info';
export interface WarmViewsService {
    readonly warmAll: Effect.Effect<void, Error>;
    readonly designsCurrentlyUpdating: Effect.Effect<{
        dbName: string;
        designId: string;
    }[], Error>;
}
export declare const WarmViewsService: Context.Tag<WarmViewsService, WarmViewsService>;
export declare const WarmViewsServiceLive: Layer.Layer<WarmViewsService, never, CouchDbsInfoService | CouchDesignInfoService | CouchDesignService | CouchViewService | CouchDesignDocsService>;
//# sourceMappingURL=warm-views.d.ts.map