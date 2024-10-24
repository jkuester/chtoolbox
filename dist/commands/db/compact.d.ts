import { Command } from '@effect/cli';
import { CompactService } from '../../services/compact';
export declare const compact: Command.Command<"compact", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | CompactService, Error, {
    readonly follow: boolean;
    readonly databases: [string, ...string[]];
}>;
//# sourceMappingURL=compact.d.ts.map