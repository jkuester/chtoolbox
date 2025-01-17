import { Command } from '@effect/cli';
import { PouchDBService } from '../../services/pouchdb.js';
export declare const create: Command.Command<"create", import("../../services/environment.js").EnvironmentService | Command.Command.Context<"chtx"> | PouchDBService, Error, {
    readonly databases: [string, ...string[]];
}>;
//# sourceMappingURL=create.d.ts.map