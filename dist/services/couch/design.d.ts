import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
export interface CouchDesignService {
    readonly getViewNames: (dbName: string, designName: string) => Effect.Effect<string[], Error>;
}
export declare const CouchDesignService: Context.Tag<CouchDesignService, CouchDesignService>;
export declare const CouchDesignServiceLive: Layer.Layer<CouchDesignService, never, CouchService>;
//# sourceMappingURL=design.d.ts.map