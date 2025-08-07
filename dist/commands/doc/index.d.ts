import { Command } from '@effect/cli';
export declare const doc: Command.Command<"doc", import("../../services/cht-client.ts").ChtClientService | Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService | import("../../services/pouchdb.ts").PouchDBService | import("../../services/purge.ts").PurgeService | import("../../services/replicate.ts").ReplicateService | import("@effect/platform/Terminal").Terminal | import("../../services/test-data-generator.ts").TestDataGeneratorService, Error | import("effect/ParseResult").ParseError, {
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
        readonly contacts: string[];
        readonly source: string;
        readonly target: string;
        readonly all: boolean;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map