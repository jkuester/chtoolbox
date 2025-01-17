import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { CompactService } from '../../services/compact.js';
import { CouchActiveTaskStream } from '../../libs/couch/active-tasks.js';
import { ChtClientService } from '../../services/cht-client.js';
export declare const streamActiveTasks: (taskStream: CouchActiveTaskStream) => Effect.Effect<void, Error, ChtClientService>;
export declare const compact: Command.Command<"compact", import("../../services/environment.js").EnvironmentService | ChtClientService | Command.Command.Context<"chtx"> | CompactService, Error, {
    readonly follow: boolean;
    readonly databases: string[];
    readonly all: boolean;
}>;
//# sourceMappingURL=compact.d.ts.map