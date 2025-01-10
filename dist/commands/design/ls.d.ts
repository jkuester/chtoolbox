import { Command } from '@effect/cli';
import { Option } from 'effect';
export declare const ls: Command.Command<"ls", import("../../services/environment").EnvironmentService | import("../../services/cht-client").ChtClientService | Command.Command.Context<"chtx">, Error, {
    readonly database: Option.Option<string>;
}>;
//# sourceMappingURL=ls.d.ts.map