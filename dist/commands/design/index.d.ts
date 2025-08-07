import { Command } from '@effect/cli';
export declare const design: Command.Command<"design", import("../../services/cht-client.ts").ChtClientService | import("../../services/compact.ts").CompactService | Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly follow: boolean;
        readonly database: string;
        readonly designs: [string, ...string[]];
    } | {
        readonly database: string;
        readonly designs: [string, ...string[]];
    } | {
        readonly database: import("effect/Option").Option<string>;
    }>;
}>;
//# sourceMappingURL=index.d.ts.map