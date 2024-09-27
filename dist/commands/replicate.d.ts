import { Command } from '@effect/cli';
import { ReplicateService } from '../services/replicate';
export declare const replicate: Command.Command<"replicate", import("../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | ReplicateService, Error, {
    readonly follow: boolean;
    readonly source: string;
    readonly target: string;
}>;
//# sourceMappingURL=replicate.d.ts.map