import { Command } from '@effect/cli';
import { ReplicateService } from '../../services/replicate';
import { CouchActiveTasksService } from '../../services/couch/active-tasks';
import { ParseError } from 'effect/Cron';
export declare const replicate: Command.Command<"replicate", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | CouchActiveTasksService | ReplicateService, Error | ParseError, {
    readonly follow: boolean;
    readonly source: string;
    readonly target: string;
    readonly all: boolean;
}>;
//# sourceMappingURL=replicate.d.ts.map