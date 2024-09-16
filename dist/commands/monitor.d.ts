import { Command } from '@effect/cli';
import { CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbsInfoService } from '../services/couch/dbs-info';
export declare const monitor: Command.Command<"monitor", import("../services/environment").EnvironmentService | CouchNodeSystemService | CouchDbsInfoService | Command.Command.Context<"chtx">, Error | import("@effect/platform/HttpBody").HttpBodyError, {
    readonly interval: number;
}>;
//# sourceMappingURL=monitor.d.ts.map