import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Stream } from 'effect';
import { CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignDocsService } from './couch/design-docs';
import { CouchCompactService } from './couch/compact';
import { CouchDesignInfoService } from './couch/design-info';
import { CouchActiveTask, CouchActiveTasksService } from './couch/active-tasks';
export interface CompactService {
    readonly compactAll: () => Effect.Effect<Stream.Stream<CouchActiveTask[], Error>, Error>;
    readonly compactDb: (dbName: string) => Effect.Effect<Stream.Stream<CouchActiveTask[], Error>, Error>;
}
export declare const CompactService: Context.Tag<CompactService, CompactService>;
export declare const CompactServiceLive: Layer.Layer<CompactService, never, CouchDbsInfoService | CouchDesignInfoService | CouchDesignDocsService | CouchCompactService | CouchActiveTasksService>;
//# sourceMappingURL=compact.d.ts.map