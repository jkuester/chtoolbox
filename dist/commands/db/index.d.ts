import { Command } from '@effect/cli';
export declare const db: Command.Command<"db", import("../../services/cht-client.ts").ChtClientService | import("../../services/compact.ts").CompactService | Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService | import("../../services/pouchdb.ts").PouchDBService | import("@effect/platform/Terminal").Terminal, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly databases: [string, ...string[]];
    } | {
        readonly follow: boolean;
        readonly databases: string[];
        readonly all: boolean;
    } | {
        readonly databases: [string, ...string[]];
    } | {} | {
        readonly databases: [string, ...string[]];
        readonly yes: boolean;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map