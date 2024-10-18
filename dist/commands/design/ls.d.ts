import { Command } from '@effect/cli';
import { Option } from 'effect';
import { CouchDesignDocsService } from '../../services/couch/design-docs';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';
export declare const ls: Command.Command<"ls", import("../../services/environment").EnvironmentService | CouchDbsInfoService | Command.Command.Context<"chtx"> | CouchDesignDocsService, Error | import("@effect/platform/HttpClientError").ResponseError | import("@effect/schema/ParseResult").ParseError, {
    readonly database: Option.Option<string>;
}>;
//# sourceMappingURL=ls.d.ts.map