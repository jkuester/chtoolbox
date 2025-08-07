import { Command } from '@effect/cli';
import { PouchDBService } from '../../services/pouchdb.js';
export declare const rm: Command.Command<"rm", Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService | PouchDBService | import("@effect/platform/Terminal").Terminal, Error | import("@effect/platform/Terminal").QuitException, {
    readonly databases: [string, ...string[]];
    readonly yes: boolean;
}>;
//# sourceMappingURL=rm.d.ts.map