import { Command } from '@effect/cli';
import { PouchDBService } from '../../services/pouchdb.js';
export declare const create: Command.Command<"create", Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService | PouchDBService, Error, {
    readonly databases: [string, ...string[]];
}>;
//# sourceMappingURL=create.d.ts.map