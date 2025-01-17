import { Command } from '@effect/cli';
export declare const design: Command.Command<"design", import("../../services/environment.js").EnvironmentService | import("../../services/cht-client.js").ChtClientService | Command.Command.Context<"chtx"> | import("../../services/compact.js").CompactService, Error, {
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