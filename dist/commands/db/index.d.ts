import { Command } from '@effect/cli';
export declare const db: Command.Command<"db", import("../../services/environment.js").EnvironmentService | import("../../services/cht-client.js").ChtClientService | Command.Command.Context<"chtx"> | import("../../services/compact.js").CompactService | import("../../services/pouchdb.js").PouchDBService | import("@effect/platform/Terminal").Terminal, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly databases: [string, ...string[]];
    } | {
        readonly databases: [string, ...string[]];
    } | {
        readonly databases: [string, ...string[]];
        readonly yes: boolean;
    } | {
        readonly follow: boolean;
        readonly databases: string[];
        readonly all: boolean;
    } | {}>;
}>;
//# sourceMappingURL=index.d.ts.map