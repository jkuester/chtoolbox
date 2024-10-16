import { Command } from '@effect/cli';
import { ReplicateService } from '../../services/replicate';
import { CouchActiveTasksService } from '../../services/couch/active-tasks';
export declare const replicate: Command.Command<"replicate", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | CouchActiveTasksService | ReplicateService, Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, {
    readonly follow: boolean;
    readonly source: string;
    readonly target: string;
}>;
//# sourceMappingURL=replicate.d.ts.map