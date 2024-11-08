import { Command } from '@effect/cli';
import { WarmViewsService } from '../services/warm-views';
export declare const warmViews: Command.Command<"warm-views", import("../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | WarmViewsService, Error, {
    readonly follow: boolean;
}>;
//# sourceMappingURL=warm-views.d.ts.map