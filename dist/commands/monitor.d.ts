import { Command } from '@effect/cli';
import { MonitorService } from '../services/monitor';
export declare const monitor: Command.Command<"monitor", import("../services/environment").EnvironmentService | import("../services/couch/node-system").CouchNodeSystemService | import("../services/couch/dbs-info").CouchDbsInfoService | import("../services/couch/design-info").CouchDesignInfoService | MonitorService | Command.Command.Context<"chtx">, Error, {
    readonly interval: number;
}>;
//# sourceMappingURL=monitor.d.ts.map