import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchDesignService } from './couch/design';
import { CouchView, CouchViewService } from './couch/view';
import { CouchResponseEffect } from './couch/couch';
import { CouchDesignInfoService } from './couch/design-info';
export interface WarmViewsService {
    readonly warmAll: CouchResponseEffect<readonly CouchView[], never, CouchDbsInfoService | CouchDesignDocsService | CouchDesignService | CouchViewService>;
    readonly designsCurrentlyUpdating: CouchResponseEffect<{
        dbName: string;
        designId: string;
    }[], never, CouchDbsInfoService | CouchDesignDocsService | CouchDesignInfoService>;
}
export declare const WarmViewsService: Context.Tag<WarmViewsService, WarmViewsService>;
export declare const WarmViewsServiceLive: Layer.Layer<WarmViewsService, never, never>;
//# sourceMappingURL=warm-views.d.ts.map