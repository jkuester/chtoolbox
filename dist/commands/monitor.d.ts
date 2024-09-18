import { Command } from '@effect/cli';
import { Option } from 'effect';
import { MonitorService } from '../services/monitor';
export declare const monitor: Command.Command<"monitor", import("../services/environment").EnvironmentService | import("@effect/platform/HttpClient").HttpClient.Default | import("../services/couch/couch").CouchService | import("../services/couch/node-system").CouchNodeSystemService | import("../services/couch/dbs-info").CouchDbsInfoService | import("../services/couch/design-info").CouchDesignInfoService | import("../services/local-disk-usage").LocalDiskUsageService | import("@effect/platform/CommandExecutor").CommandExecutor | MonitorService | Command.Command.Context<"chtx">, Error | import("@effect/platform/Error").PlatformError, {
    readonly interval: number;
    readonly trackDirSize: Option.Option<string>;
}>;
//# sourceMappingURL=monitor.d.ts.map