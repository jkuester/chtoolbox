import { Command } from '@effect/cli';
import { CompactService } from '../../services/compact.ts';
export declare const compact: Command.Command<"compact", import("../../services/cht-client.ts").ChtClientService | CompactService | Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService, Error, {
    readonly follow: boolean;
    readonly database: string;
    readonly designs: [string, ...string[]];
}>;
//# sourceMappingURL=compact.d.ts.map