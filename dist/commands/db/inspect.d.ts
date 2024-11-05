import { Command } from '@effect/cli';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';
export declare const inspect: Command.Command<"inspect", import("../../services/environment").EnvironmentService | CouchDbsInfoService | Command.Command.Context<"chtx">, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, {
    readonly databases: [string, ...string[]];
}>;
//# sourceMappingURL=inspect.d.ts.map