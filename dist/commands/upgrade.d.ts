import { Command } from '@effect/cli';
import { UpgradeService } from '../services/upgrade';
export declare const upgrade: Command.Command<"upgrade", import("../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | UpgradeService, Error | import("effect/Cause").UnknownException, {
    readonly version: string;
    readonly follow: boolean;
    readonly stage: boolean;
    readonly complete: boolean;
}>;
//# sourceMappingURL=upgrade.d.ts.map