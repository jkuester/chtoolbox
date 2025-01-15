import { Command } from '@effect/cli';
import { CompactService } from '../../services/compact.js';
export declare const compact: Command.Command<"compact", import("../../services/environment.js").EnvironmentService | import("../../services/cht-client.js").ChtClientService | Command.Command.Context<"chtx"> | CompactService, Error, {
    readonly follow: boolean;
    readonly database: string;
    readonly designs: [string, ...string[]];
}>;
//# sourceMappingURL=compact.d.ts.map