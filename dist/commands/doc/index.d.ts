import { Command } from '@effect/cli';
export declare const doc: Command.Command<"doc", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | import("@effect/platform/Terminal").Terminal | import("../../services/couch/purge").CouchPurgeService | import("../../services/purge").PurgeService, Error | import("@effect/platform/Terminal").QuitException, {
    readonly subcommand: import("effect/Option").Option<{
        readonly database: string;
        readonly yes: boolean;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map