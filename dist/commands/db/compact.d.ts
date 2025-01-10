import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { CompactService } from '../../services/compact';
import { CouchActiveTaskStream } from '../../services/couch/active-tasks';
import { ChtClientService } from '../../services/cht-client';
export declare const streamActiveTasks: (taskStream: CouchActiveTaskStream) => Effect.Effect<void, Error, ChtClientService>;
export declare const compact: Command.Command<"compact", import("../../services/environment").EnvironmentService | ChtClientService | Command.Command.Context<"chtx"> | CompactService, Error, {
    readonly follow: boolean;
    readonly databases: string[];
    readonly all: boolean;
}>;
//# sourceMappingURL=compact.d.ts.map