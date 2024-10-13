import { Command } from '@effect/cli';
export declare const db: Command.Command<"db", import("../../services/environment").EnvironmentService | import("../../services/couch/dbs-info").CouchDbsInfoService | Command.Command.Context<"chtx"> | import("../../services/couch/active-tasks").CouchActiveTasksService | import("../../services/compact").CompactService | import("../../services/pouchdb").PouchDBService | import("../../services/replicate").ReplicateService | import("@effect/platform/Terminal").Terminal, Error | import("@effect/platform/Terminal").QuitException, {
    readonly subcommand: import("effect/Option").Option<{
        readonly databases: [string, ...string[]];
    } | {
        readonly follow: boolean;
        readonly source: string;
        readonly target: string;
    } | {
        readonly databases: [string, ...string[]];
    } | {
        readonly databases: [string, ...string[]];
        readonly yes: boolean;
    } | {
        readonly follow: boolean;
        readonly databases: [string, ...string[]];
    } | {}>;
}>;
//# sourceMappingURL=index.d.ts.map