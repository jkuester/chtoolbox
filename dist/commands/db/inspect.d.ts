import { Command } from '@effect/cli';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';
export declare const inspect: Command.Command<"inspect", import("../../services/environment").EnvironmentService | CouchDbsInfoService | Command.Command.Context<"chtx">, Error, {
    readonly databases: [string, ...string[]];
}>;
//# sourceMappingURL=inspect.d.ts.map