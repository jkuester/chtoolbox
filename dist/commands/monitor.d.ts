import { Command } from '@effect/cli';
import { Option } from 'effect';
import { MonitorService } from '../services/monitor';
export declare const monitor: Command.Command<"monitor", import("../services/environment").EnvironmentService | MonitorService | Command.Command.Context<"chtx">, Error, {
    readonly interval: number;
    readonly trackDirSize: Option.Option<string>;
}>;
//# sourceMappingURL=monitor.d.ts.map