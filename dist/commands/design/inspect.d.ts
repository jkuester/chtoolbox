import { Command } from '@effect/cli';
export declare const inspect: Command.Command<"inspect", import("../../services/environment").EnvironmentService | import("../../services/cht-client").ChtClientService | Command.Command.Context<"chtx">, Error, {
    readonly database: string;
    readonly designs: [string, ...string[]];
}>;
//# sourceMappingURL=inspect.d.ts.map