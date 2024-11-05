import * as Effect from 'effect/Effect';
import { PouchDBService } from './pouchdb';
import { Schema } from '@effect/schema';
import { Stream } from 'effect';
import { ChtUpgradeService } from './cht/upgrade';
declare const UpgradeLog_base: Schema.Class<UpgradeLog, {
    _id: typeof Schema.String;
    state: Schema.Schema<string, string, never>;
    state_history: Schema.Array$<Schema.Struct<{
        state: Schema.Schema<string, string, never>;
        date: typeof Schema.Number;
    }>>;
}, Schema.Struct.Encoded<{
    _id: typeof Schema.String;
    state: Schema.Schema<string, string, never>;
    state_history: Schema.Array$<Schema.Struct<{
        state: Schema.Schema<string, string, never>;
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
declare const UpgradeService_base: Effect.Service.Class<UpgradeService, "chtoolbox/UpgradeService", {
    readonly effect: Effect.Effect<{
        upgrade: (version: string) => Effect.Effect<Stream.Stream<UpgradeLog, Error, never>, Error | import("effect/Cause").UnknownException, never>;
        stage: (version: string) => Effect.Effect<Stream.Stream<UpgradeLog, Error, never>, Error | import("effect/Cause").UnknownException, never>;
        complete: (version: string) => Effect.Effect<Stream.Stream<UpgradeLog, Error, never>, Error | import("effect/Cause").UnknownException, never>;
    }, never, PouchDBService | ChtUpgradeService>;
    readonly accessors: true;
}>;
export declare class UpgradeService extends UpgradeService_base {
}
export {};
//# sourceMappingURL=upgrade.d.ts.map