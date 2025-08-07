import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { CompactService } from '../../services/compact.js';
import { CouchActiveTask, CouchActiveTaskStream } from '../../libs/couch/active-tasks.js';
import { ChtClientService } from '../../services/cht-client.js';
export declare const getTaskDisplayData: (task: CouchActiveTask) => {
    database: string;
    pid: string;
    progress: string;
};
export declare const streamActiveTasks: (taskStream: CouchActiveTaskStream) => Effect.Effect<void, Error, ChtClientService>;
export declare const compact: Command.Command<"compact", ChtClientService | CompactService | Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService, Error, {
    readonly follow: boolean;
    readonly databases: string[];
    readonly all: boolean;
}>;
//# sourceMappingURL=compact.d.ts.map