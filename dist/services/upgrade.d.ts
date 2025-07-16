import * as Effect from 'effect/Effect';
import { PouchDBService } from './pouchdb.js';
import { Schema, Stream } from 'effect';
import { ChtClientService } from './cht-client.js';
import { WarmViewsService } from './warm-views.js';
import { CouchActiveTaskStream } from '../libs/couch/active-tasks.js';
declare const UpgradeLog_base: Schema.Class<UpgradeLog, {
    _id: typeof Schema.String;
    state: Schema.SchemaClass<string, string, never>;
    state_history: Schema.Array$<Schema.Struct<{
        state: Schema.SchemaClass<string, string, never>;
        date: typeof Schema.Number;
    }>>;
}, Schema.Struct.Encoded<{
    _id: typeof Schema.String;
    state: Schema.SchemaClass<string, string, never>;
    state_history: Schema.Array$<Schema.Struct<{
        state: Schema.SchemaClass<string, string, never>;
        date: typeof Schema.Number;
    }>>;
}>, never, {
    readonly _id: string;
} & {
    readonly state: string;
} & {
    readonly state_history: readonly {
        readonly state: string;
        readonly date: number;
    }[];
}, {}, {}>;
export declare class UpgradeLog extends UpgradeLog_base {
}
type UpgradeLogStreamEffect = Effect.Effect<Stream.Stream<UpgradeLog, Error>, Error>;
declare const UpgradeService_base: Effect.Service.Class<UpgradeService, "chtoolbox/UpgradeService", {
    readonly effect: Effect.Effect<{
        upgrade: (version: string) => UpgradeLogStreamEffect;
        stage: (version: string) => UpgradeLogStreamEffect;
        complete: (version: string) => UpgradeLogStreamEffect;
        preStage: (version: string) => Effect.Effect<CouchActiveTaskStream, Error>;
    }, never, ChtClientService | WarmViewsService | PouchDBService>;
    readonly accessors: true;
}>;
export declare class UpgradeService extends UpgradeService_base {
}
export {};
//# sourceMappingURL=upgrade.d.ts.map