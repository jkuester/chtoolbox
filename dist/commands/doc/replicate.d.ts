import { Command } from '@effect/cli';
import { ReplicateService } from '../../services/replicate.js';
import { ParseError } from 'effect/Cron';
export declare const replicate: Command.Command<"replicate", import("../../services/environment.js").EnvironmentService | import("../../services/cht-client.js").ChtClientService | Command.Command.Context<"chtx"> | ReplicateService, Error | ParseError, {
    readonly follow: boolean;
    readonly contacts: string[];
    readonly source: string;
    readonly target: string;
    readonly all: boolean;
}>;
//# sourceMappingURL=replicate.d.ts.map