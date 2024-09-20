import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
export interface CouchCompactService {
    readonly compactDb: (dbName: string) => Effect.Effect<void, Error>;
    readonly compactDesign: (dbName: string, viewName: string) => Effect.Effect<void, Error>;
}
export declare const CouchCompactService: Context.Tag<CouchCompactService, CouchCompactService>;
export declare const CouchCompactServiceLive: Layer.Layer<CouchCompactService, never, CouchService>;
//# sourceMappingURL=compact.d.ts.map