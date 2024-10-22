import { Command } from '@effect/cli';
export declare const doc: Command.Command<"doc", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | import("@effect/platform/Terminal").Terminal | import("../../services/purge").PurgeService, Error | import("@effect/platform/Terminal").QuitException, {
    readonly subcommand: import("effect/Option").Option<{
        readonly contacts: import("effect/Option").Option<string>;
        readonly database: string;
        readonly yes: boolean;
        readonly all: boolean;
        readonly reports: boolean;
        readonly before: import("effect/Option").Option<Date>;
        readonly since: import("effect/Option").Option<Date>;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map