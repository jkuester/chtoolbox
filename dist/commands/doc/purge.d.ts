import { Command } from '@effect/cli';
import { Option } from 'effect';
import { PurgeService } from '../../services/purge.js';
export declare const purge: Command.Command<"purge", import("../../services/environment.js").EnvironmentService | Command.Command.Context<"chtx"> | import("@effect/platform/Terminal").Terminal | PurgeService, Error | import("@effect/platform/Terminal").QuitException, {
    readonly contacts: Option.Option<string>;
    readonly database: string;
    readonly yes: boolean;
    readonly all: boolean;
    readonly reports: boolean;
    readonly before: Option.Option<Date>;
    readonly since: Option.Option<Date>;
}>;
//# sourceMappingURL=purge.d.ts.map