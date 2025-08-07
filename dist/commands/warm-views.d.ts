import { Command } from '@effect/cli';
import { WarmViewsService } from '../services/warm-views.js';
export declare const warmViews: Command.Command<"warm-views", Command.Command.Context<"chtx"> | import("../services/environment.ts").EnvironmentService | WarmViewsService, Error, {
    readonly follow: boolean;
}>;
//# sourceMappingURL=warm-views.d.ts.map