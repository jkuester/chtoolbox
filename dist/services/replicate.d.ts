import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { PouchDBService } from './pouchdb';
import { EnvironmentService } from './environment';
export interface ReplicateService {
    readonly replicateAsync: (source: string, target: string) => Effect.Effect<(PouchDB.Core.Response | PouchDB.Core.Error)[], Error>;
    readonly replicate: (source: string, target: string) => Effect.Effect<PouchDB.Replication.Replication<object>, Error>;
}
export declare const ReplicateService: Context.Tag<ReplicateService, ReplicateService>;
export declare const ReplicateServiceLive: Layer.Layer<ReplicateService, never, EnvironmentService | PouchDBService>;
//# sourceMappingURL=replicate.d.ts.map