import { Command } from '@effect/cli';
import { ReplicateService } from '../../services/replicate';
import { ParseError } from 'effect/Cron';
export declare const replicate: Command.Command<"replicate", import("../../services/environment").EnvironmentService | import("../../services/cht-client").ChtClientService | Command.Command.Context<"chtx"> | ReplicateService, Error | ParseError, {
    readonly follow: boolean;
    readonly source: string;
    readonly target: string;
    readonly all: boolean;
}>;
//# sourceMappingURL=replicate.d.ts.map