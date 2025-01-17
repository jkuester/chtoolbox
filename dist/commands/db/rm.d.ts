import { Command } from '@effect/cli';
import { PouchDBService } from '../../services/pouchdb.js';
export declare const rm: Command.Command<"rm", import("../../services/environment.js").EnvironmentService | Command.Command.Context<"chtx"> | PouchDBService | import("@effect/platform/Terminal").Terminal, Error | import("@effect/platform/Terminal").QuitException, {
    readonly databases: [string, ...string[]];
    readonly yes: boolean;
}>;
//# sourceMappingURL=rm.d.ts.map