import { Command } from '@effect/cli';
export declare const design: Command.Command<"design", import("../../services/environment").EnvironmentService | import("../../services/couch/design-info").CouchDesignInfoService | Command.Command.Context<"chtx">, Error, {
    readonly subcommand: import("effect/Option").Option<{
        readonly database: string;
        readonly designs: [string, ...string[]];
    }>;
}>;
//# sourceMappingURL=index.d.ts.map