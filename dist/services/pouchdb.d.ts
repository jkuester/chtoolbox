import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { Layer } from 'effect';
import { EnvironmentService } from './environment';
export interface PouchDBService {
    readonly get: (dbName: string) => Effect.Effect<PouchDB.Database, Error>;
}
export declare const PouchDBService: Context.Tag<PouchDBService, PouchDBService>;
export declare const PouchDBServiceLive: Layer.Layer<PouchDBService, never, EnvironmentService>;
//# sourceMappingURL=pouchdb.d.ts.map