import { Command } from '@effect/cli';
import { WarmViewsService } from '../services/warm-views';
export declare const warmViews: Command.Command<"warm-views", import("../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | WarmViewsService, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError, {
    readonly follow: boolean;
}>;
//# sourceMappingURL=warm-views.d.ts.map