import { Command } from '@effect/cli';
import { Effect, Stream } from 'effect';
import { CompactService } from '../../services/compact';
import { CouchActiveTask } from '../../services/couch/active-tasks';
export declare const streamActiveTasks: (taskStream: Stream.Stream<CouchActiveTask[], Error>) => Effect.Effect<void, Error>;
export declare const compact: Command.Command<"compact", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | CompactService, Error, {
    readonly follow: boolean;
    readonly databases: string[];
    readonly all: boolean;
}>;
//# sourceMappingURL=compact.d.ts.map