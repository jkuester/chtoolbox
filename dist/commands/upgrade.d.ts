import { Command } from '@effect/cli';
import { UpgradeService } from '../services/upgrade.js';
import { ChtClientService } from '../services/cht-client.js';
export declare const upgrade: Command.Command<"upgrade", import("../services/environment.js").EnvironmentService | ChtClientService | Command.Command.Context<"chtx"> | UpgradeService, Error, {
    readonly version: string;
    readonly follow: boolean;
    readonly stage: boolean;
    readonly complete: boolean;
    readonly preStage: boolean;
}>;
//# sourceMappingURL=upgrade.d.ts.map