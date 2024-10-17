import { Command } from '@effect/cli';
import { PurgeService } from '../../services/purge';
export declare const purge: Command.Command<"purge", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | import("@effect/platform/Terminal").Terminal | import("../../services/couch/purge").CouchPurgeService | PurgeService, Error | import("@effect/platform/Terminal").QuitException, {
    readonly database: string;
    readonly yes: boolean;
}>;
//# sourceMappingURL=purge.d.ts.map