import { Command } from '@effect/cli';
export declare const doc: Command.Command<"doc", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | import("../../services/couch/active-tasks").CouchActiveTasksService | import("../../services/replicate").ReplicateService | import("@effect/platform/Terminal").Terminal | import("../../services/purge").PurgeService, Error | import("@effect/platform/HttpClientError").ResponseError | import("effect/ParseResult").ParseError | import("@effect/platform/Terminal").QuitException | import("effect/Cron").ParseError, {
    readonly subcommand: import("effect/Option").Option<{
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