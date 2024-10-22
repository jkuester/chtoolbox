import * as Effect from 'effect/Effect';
import { PouchDBService } from './pouchdb';
import { EnvironmentService } from './environment';
import { Schema } from '@effect/schema';
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
declare const ReplicateService_base: Effect.Service.Class<ReplicateService, "chtoolbox/ReplicateService", {
    readonly effect: Effect.Effect<{
        replicate: (source: string, target: string, includeDdocs?: boolean) => Effect.Effect<PouchDB.Core.Response, never, never>;
        watch: (repDocId: string) => Effect.Effect<PouchDB.Core.Changes<ReplicationDoc>, never, never>;
    }, never, EnvironmentService | PouchDBService>;
    readonly accessors: true;
}>;
export declare class ReplicateService extends ReplicateService_base {
}
export {};
//# sourceMappingURL=replicate.d.ts.map