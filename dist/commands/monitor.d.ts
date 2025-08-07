import { Command } from '@effect/cli';
import { Option } from 'effect';
import { MonitorService } from '../services/monitor.ts';
export declare const monitor: Command.Command<"monitor", Command.Command.Context<"chtx"> | import("../services/environment.ts").EnvironmentService | MonitorService, Error, {
    readonly interval: number;
    readonly trackDirSize: Option.Option<string>;
}>;
//# sourceMappingURL=monitor.d.ts.map