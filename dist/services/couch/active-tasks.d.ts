import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';
import { Stream, Option } from 'effect';
import { DurationInput } from 'effect/Duration';
declare const CouchActiveTask_base: Schema.Class<CouchActiveTask, {
    database: typeof Schema.String;
    design_document: Schema.UndefinedOr<typeof Schema.String>;
    doc_id: Schema.UndefinedOr<typeof Schema.String>;
    docs_written: Schema.UndefinedOr<typeof Schema.Number>;
    pid: typeof Schema.String;
    progress: Schema.UndefinedOr<typeof Schema.Number>;
    started_on: typeof Schema.Number;
    type: typeof Schema.String;
}, Schema.Struct.Encoded<{
    database: typeof Schema.String;
    design_document: Schema.UndefinedOr<typeof Schema.String>;
    doc_id: Schema.UndefinedOr<typeof Schema.String>;
    docs_written: Schema.UndefinedOr<typeof Schema.Number>;
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
    readonly doc_id: string | undefined;
} & {
    readonly docs_written: number | undefined;
} & {
    readonly progress: number | undefined;
}, {}, {}>;
export declare class CouchActiveTask extends CouchActiveTask_base {
    static readonly decodeResponse: <E, E2, R2>(effect: Effect.Effect<import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>, E2, R2>) => Effect.Effect<readonly CouchActiveTask[], import("@effect/schema/ParseResult").ParseError | E | E2, Exclude<R2, import("effect/Scope").Scope>>;
}
export interface CouchActiveTasksService {
    readonly get: () => Effect.Effect<CouchActiveTask[], Error>;
    readonly stream: (interval?: DurationInput) => Stream.Stream<CouchActiveTask[], Error>;
}
export declare const getDesignName: (task: CouchActiveTask) => Option.Option<string>;
export declare const getDbName: (task: CouchActiveTask) => string;
export declare const getPid: (task: CouchActiveTask) => string;
export declare const getProgressPct: (task: CouchActiveTask) => string;
export declare const getDisplayDictByPid: (tasks: {
    pid: string;
}[]) => Record<string | symbol, Record<string, string> | Record<string | symbol, string>>;
export declare const filterStreamByType: (...types: string[]) => (taskStream: Stream.Stream<CouchActiveTask[], Error>) => Stream.Stream<CouchActiveTask[], Error, never>;
export declare const CouchActiveTasksService: Context.Tag<CouchActiveTasksService, CouchActiveTasksService>;
export declare const CouchActiveTasksServiceLive: Layer.Layer<CouchActiveTasksService, never, CouchService>;
export {};
//# sourceMappingURL=active-tasks.d.ts.map