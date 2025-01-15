import { Command } from '@effect/cli';
export declare const inspect: Command.Command<"inspect", import("../../services/environment.js").EnvironmentService | import("../../services/cht-client.js").ChtClientService | Command.Command.Context<"chtx">, Error, {
    readonly database: string;
    readonly designs: [string, ...string[]];
}>;
//# sourceMappingURL=inspect.d.ts.map