import * as Effect from 'effect/Effect';
import { PouchDBService } from './pouchdb';
import { EnvironmentService } from './environment';
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
    readonly _id: string;
} & {
    readonly _replication_state?: string | undefined;
} & {
    readonly _replication_stats?: {
        readonly docs_written: number;
    } | undefined;
}, {}, {}>;
export declare class ReplicationDoc extends ReplicationDoc_base {
}
declare const ReplicateService_base: Effect.Service.Class<ReplicateService, "chtoolbox/ReplicateService", {
    readonly effect: Effect.Effect<{
        replicate: (source: string, target: string, includeDdocs?: boolean) => Effect.Effect<Stream.Stream<ReplicationDoc, Error>, Error>;
    }, never, EnvironmentService | PouchDBService>;
    readonly accessors: true;
}>;
export declare class ReplicateService extends ReplicateService_base {
}
export {};
//# sourceMappingURL=replicate.d.ts.map