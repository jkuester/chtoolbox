import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect } from './couch';
export interface CouchDesignService {
    readonly getViewNames: (dbName: string, designName: string) => CouchResponseEffect<string[]>;
}
export declare const CouchDesignService: Context.Tag<CouchDesignService, CouchDesignService>;
export declare const CouchDesignServiceLive: Layer.Layer<CouchDesignService, never, never>;
//# sourceMappingURL=design.d.ts.map