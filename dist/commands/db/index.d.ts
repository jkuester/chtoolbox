import { Command } from '@effect/cli';
export declare const db: Command.Command<"db", import("../../services/environment").EnvironmentService | import("../../services/couch/dbs-info").CouchDbsInfoService | Command.Command.Context<"chtx"> | import("../../services/couch/active-tasks").CouchActiveTasksService | import("../../services/replicate").ReplicateService, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly databases: [string, ...string[]];
    } | {
        readonly follow: boolean;
        readonly source: string;
        readonly target: string;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map