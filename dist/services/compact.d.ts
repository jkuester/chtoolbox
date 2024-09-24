import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
export interface CompactService {
    readonly compactAll: () => Effect.Effect<void, Error>;
    readonly currentlyCompacting: () => Effect.Effect<string[], Error>;
}
export declare const CompactService: Context.Tag<CompactService, CompactService>;
export declare const CompactServiceLive: Layer.Layer<CompactService, never, CouchDbsInfoService | CouchDesignInfoService | CouchDesignDocsService | CouchCompactService>;
//# sourceMappingURL=compact.d.ts.map