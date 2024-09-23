import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
export interface CouchViewService {
    readonly warm: (dbName: string, designName: string, viewName: string) => Effect.Effect<void, Error>;
}
export declare const CouchViewService: Context.Tag<CouchViewService, CouchViewService>;
export declare const CouchViewServiceLive: Layer.Layer<CouchViewService, never, CouchService>;
//# sourceMappingURL=view.d.ts.map