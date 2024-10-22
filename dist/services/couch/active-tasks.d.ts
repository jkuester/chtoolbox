import * as Schema from '@effect/schema/Schema';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
import { Option, Stream } from 'effect';
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
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<readonly CouchActiveTask[], import("@effect/schema/ParseResult").ParseError | E, never>;
}
export declare const getDesignName: (task: CouchActiveTask) => Option.Option<string>;
export declare const getDbName: (task: CouchActiveTask) => string;
export declare const getPid: (task: CouchActiveTask) => string;
export declare const getProgressPct: (task: CouchActiveTask) => string;
export declare const getDisplayDictByPid: (tasks: {
    pid: string;
}[]) => Record<string | symbol, Record<string, string> | Record<string | symbol, string>>;
export declare const filterStreamByType: (...types: string[]) => (taskStream: Stream.Stream<CouchActiveTask[], Error>) => Stream.Stream<CouchActiveTask[], Error, never>;
declare const CouchActiveTasksService_base: Effect.Service.Class<CouchActiveTasksService, "chtoolbox/CouchActiveTasksService", {
    readonly effect: Effect.Effect<{
        get: () => Effect.Effect<CouchActiveTask[], Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, never>;
        stream: (interval?: number) => Stream.Stream<CouchActiveTask[], Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CouchActiveTasksService extends CouchActiveTasksService_base {
}
export {};
//# sourceMappingURL=active-tasks.d.ts.map