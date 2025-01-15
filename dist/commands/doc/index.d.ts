import { Command } from '@effect/cli';
export declare const doc: Command.Command<"doc", import("../../services/environment.js").EnvironmentService | import("../../services/cht-client.js").ChtClientService | Command.Command.Context<"chtx"> | import("../../services/replicate.js").ReplicateService | import("@effect/platform/Terminal").Terminal | import("../../services/test-data-generator.js").TestDataGeneratorService | import("../../services/purge.js").PurgeService, Error | import("@effect/platform/Terminal").QuitException | import("effect/Cron").ParseError, {
    readonly subcommand: import("effect/Option").Option<{
        readonly designScriptPath: string;
    } | {
        readonly contacts: import("effect/Option").Option<string>;
        readonly database: string;
        readonly yes: boolean;
        readonly all: boolean;
        readonly reports: boolean;
        readonly before: import("effect/Option").Option<Date>;
        readonly since: import("effect/Option").Option<Date>;
    } | {
        readonly follow: boolean;
        readonly source: string;
        readonly target: string;
        readonly all: boolean;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map