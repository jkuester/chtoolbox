import { Command } from '@effect/cli';
import { UpgradeService } from '../services/upgrade.js';
import { ChtClientService } from '../services/cht-client.js';
export declare const upgrade: Command.Command<"upgrade", ChtClientService | Command.Command.Context<"chtx"> | import("../services/environment.ts").EnvironmentService | UpgradeService, string | Error, {
    readonly version: string;
    readonly follow: boolean;
    readonly stage: boolean;
    readonly complete: boolean;
    readonly preStage: boolean;
}>;
//# sourceMappingURL=upgrade.d.ts.map