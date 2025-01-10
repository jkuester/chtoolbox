import { Command } from '@effect/cli';
export declare const design: Command.Command<"design", import("../../services/environment").EnvironmentService | import("../../services/cht-client").ChtClientService | import("../../services/couch/design-info").CouchDesignInfoService | Command.Command.Context<"chtx"> | import("../../services/compact").CompactService, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly database: string;
        readonly designs: [string, ...string[]];
    } | {
        readonly follow: boolean;
        readonly database: string;
        readonly designs: [string, ...string[]];
    } | {
        readonly database: import("effect/Option").Option<string>;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map