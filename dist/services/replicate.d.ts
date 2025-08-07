import * as Effect from 'effect/Effect';
import { PouchDBService } from './pouchdb.ts';
import { EnvironmentService } from './environment.ts';
import { Schema, Stream } from 'effect';
declare const ReplicationDoc_base: Schema.Class<ReplicationDoc, {
    _id: typeof Schema.String;
    _replication_state: Schema.optional<typeof Schema.String>;
    _replication_stats: Schema.optional<Schema.Struct<{
        docs_written: typeof Schema.Number;
    }>>;
}, Schema.Struct.Encoded<{
    _id: typeof Schema.String;
    _replication_state: Schema.optional<typeof Schema.String>;
    _replication_stats: Schema.optional<Schema.Struct<{
        docs_written: typeof Schema.Number;
    }>>;
}>, never, {
    readonly _replication_state?: string | undefined;
} & {
    readonly _replication_stats?: {
        readonly docs_written: number;
    } | undefined;
} & {
    readonly _id: string;
}, {}, {}>;
export declare class ReplicationDoc extends ReplicationDoc_base {
}
interface ReplicationOptions {
    readonly includeDdocs?: boolean;
    readonly contactTypes?: string[];
}
declare const ReplicateService_base: Effect.Service.Class<ReplicateService, "chtoolbox/ReplicateService", {
    readonly effect: Effect.Effect<{
        replicate: (source: string, target: string, opts?: ReplicationOptions) => Effect.Effect<Stream.Stream<ReplicationDoc, Error, never>, Error, never>;
    }, never, EnvironmentService | PouchDBService>;
    readonly accessors: true;
}>;
export declare class ReplicateService extends ReplicateService_base {
}
export {};
//# sourceMappingURL=replicate.d.ts.map