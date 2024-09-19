import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect } from './couch';
export interface CouchCompactService {
    readonly compactDb: (dbName: string) => CouchResponseEffect<void>;
    readonly compactDesign: (dbName: string, viewName: string) => CouchResponseEffect<void>;
}
export declare const CouchCompactService: Context.Tag<CouchCompactService, CouchCompactService>;
export declare const CouchCompactServiceLive: Layer.Layer<CouchCompactService, never, never>;
//# sourceMappingURL=compact.d.ts.map