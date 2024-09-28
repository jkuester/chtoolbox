import { Command } from '@effect/cli';
export declare const db: Command.Command<"db", import("../../services/environment").EnvironmentService | import("../../services/couch/dbs-info").CouchDbsInfoService | Command.Command.Context<"chtx">, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly databases: [string, ...string[]];
    }>;
}>;
//# sourceMappingURL=index.d.ts.map