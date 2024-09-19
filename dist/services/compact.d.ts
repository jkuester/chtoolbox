import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchResponseEffect } from './couch/couch';
import { CouchDesignInfoService } from './couch/design-info';
export interface CompactService {
    readonly compactAll: CouchResponseEffect<void, never, CouchDbsInfoService | CouchDesignDocsService | CouchCompactService>;
    readonly currentlyCompacting: CouchResponseEffect<string[], never, CouchDbsInfoService | CouchDesignInfoService | CouchDesignDocsService>;
}
export declare const CompactService: Context.Tag<CompactService, CompactService>;
export declare const CompactServiceLive: Layer.Layer<CompactService, never, never>;
//# sourceMappingURL=compact.d.ts.map