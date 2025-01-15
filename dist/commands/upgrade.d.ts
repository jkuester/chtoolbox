import { Command } from '@effect/cli';
import { UpgradeService } from '../services/upgrade.js';
export declare const upgrade: Command.Command<"upgrade", import("../services/environment.js").EnvironmentService | Command.Command.Context<"chtx"> | UpgradeService, Error, {
    readonly version: string;
    readonly follow: boolean;
    readonly stage: boolean;
    readonly complete: boolean;
}>;
//# sourceMappingURL=upgrade.d.ts.map