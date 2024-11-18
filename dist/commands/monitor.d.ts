import { Command } from '@effect/cli';
import { Option } from 'effect';
import { MonitorService } from '../services/monitor.js';
export declare const monitor: Command.Command<"monitor", import("../services/environment.js").EnvironmentService | MonitorService | Command.Command.Context<"chtx">, Error, {
    readonly interval: number;
    readonly trackCouchDbDirSize: Option.Option<string>;
    readonly trackNouveauDirSize: Option.Option<string>;
}>;
//# sourceMappingURL=monitor.d.ts.map