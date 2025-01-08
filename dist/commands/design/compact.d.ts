import { Command } from '@effect/cli';
import { CompactService } from '../../services/compact';
export declare const compact: Command.Command<"compact", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | CompactService, Error, {
    readonly follow: boolean;
    readonly database: string;
    readonly designs: [string, ...string[]];
}>;
//# sourceMappingURL=compact.d.ts.map