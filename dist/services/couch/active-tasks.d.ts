import { ChtClientService } from '../cht-client';
import { Effect, Option, Schema, Stream } from 'effect';
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
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<readonly CouchActiveTask[], import("effect/ParseResult").ParseError | E, never>;
}
export declare const getDesignName: (task: CouchActiveTask) => Option.Option<string>;
export declare const getDbName: (task: CouchActiveTask) => string;
export declare const getPid: (task: CouchActiveTask) => string;
export declare const getProgressPct: (task: CouchActiveTask) => string;
export declare const getDisplayDictByPid: (tasks: {
    pid: string;
}[]) => Record<string, Record<string, string>>;
export declare const filterStreamByType: (...types: string[]) => (taskStream: CouchActiveTaskStream) => CouchActiveTaskStream;
export declare const getActiveTasks: () => Effect.Effect<CouchActiveTask[], Error, ChtClientService>;
export type CouchActiveTaskStream = Stream.Stream<CouchActiveTask[], Error, ChtClientService>;
export declare const streamActiveTasks: (interval?: number) => CouchActiveTaskStream;
export {};
//# sourceMappingURL=active-tasks.d.ts.map