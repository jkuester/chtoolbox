import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { PouchDBService } from './pouchdb';
import { EnvironmentService } from './environment';
import { Schema } from '@effect/schema';
export interface ReplicateService {
    readonly replicate: (source: string, target: string) => Effect.Effect<PouchDB.Core.Response, Error>;
    readonly watch: (repDocId: string) => Effect.Effect<PouchDB.Core.Changes<ReplicationDoc>, Error>;
}
export declare const ReplicateService: Context.Tag<ReplicateService, ReplicateService>;
declare const ReplicationDoc_base: Schema.Class<ReplicationDoc, {
    _replication_state: typeof Schema.String;
    _replication_stats: Schema.Struct<{
        docs_written: typeof Schema.Number;
    }>;
}, Schema.Struct.Encoded<{
    _replication_state: typeof Schema.String;
    _replication_stats: Schema.Struct<{
        docs_written: typeof Schema.Number;
    }>;
}>, never, {
    readonly _replication_state: string;
} & {
    readonly _replication_stats: {
        readonly docs_written: number;
    };
}, {}, {}>;
export declare class ReplicationDoc extends ReplicationDoc_base {
}
export declare const ReplicateServiceLive: Layer.Layer<ReplicateService, never, EnvironmentService | PouchDBService>;
export {};
//# sourceMappingURL=replicate.d.ts.map