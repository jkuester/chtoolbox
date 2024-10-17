import { Command } from '@effect/cli';
import { CouchActiveTasksService } from '../services/couch/active-tasks';
export declare const activeTasks: Command.Command<"active-tasks", import("../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | CouchActiveTasksService, Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, {
    readonly follow: boolean;
}>;
//# sourceMappingURL=active-tasks.d.ts.map