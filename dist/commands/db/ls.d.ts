import { Command } from '@effect/cli';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';
export declare const ls: Command.Command<"ls", import("../../services/environment").EnvironmentService | CouchDbsInfoService | Command.Command.Context<"chtx">, Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, {}>;
//# sourceMappingURL=ls.d.ts.map