import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
declare const CouchActiveTask_base: Schema.Class<CouchActiveTask, {
    database: typeof Schema.String;
    design_document: Schema.UndefinedOr<typeof Schema.String>;
    pid: typeof Schema.String;
    progress: Schema.UndefinedOr<typeof Schema.Number>;
    started_on: typeof Schema.Number;
    type: typeof Schema.String;
}, Schema.Struct.Encoded<{
    database: typeof Schema.String;
    design_document: Schema.UndefinedOr<typeof Schema.String>;
    pid: typeof Schema.String;
    progress: Schema.UndefinedOr<typeof Schema.Number>;
    started_on: typeof Schema.Number;
    type: typeof Schema.String;
}>, never, {
    readonly database: string;
} & {
    readonly pid: string;
} & {
    readonly started_on: number;
} & {
    readonly type: string;
} & {
    readonly design_document: string | undefined;
} & {
    readonly progress: number | undefined;
}, {}, {}>;
export declare class CouchActiveTask extends CouchActiveTask_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<readonly CouchActiveTask[], import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchActiveTasksService {
    readonly get: () => Effect.Effect<readonly CouchActiveTask[], Error>;
}
export declare const CouchActiveTasksService: Context.Tag<CouchActiveTasksService, CouchActiveTasksService>;
export declare const CouchActiveTasksServiceLive: Layer.Layer<CouchActiveTasksService, never, CouchService>;
export {};
//# sourceMappingURL=active-tasks.d.ts.map