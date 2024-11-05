import { Command } from '@effect/cli';
import { CouchDesignInfoService } from '../../services/couch/design-info';
import { CouchDesignService } from '../../services/couch/design';
export declare const inspect: Command.Command<"inspect", import("../../services/environment").EnvironmentService | CouchDesignInfoService | Command.Command.Context<"chtx"> | CouchDesignService, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, {
    readonly database: string;
    readonly designs: [string, ...string[]];
}>;
//# sourceMappingURL=inspect.d.ts.map