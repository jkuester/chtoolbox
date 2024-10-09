import { Command } from '@effect/cli';
import { PouchDBService } from '../../services/pouchdb';
export declare const create: Command.Command<"create", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | PouchDBService, Error, {
    readonly databases: [string, ...string[]];
}>;
//# sourceMappingURL=create.d.ts.map