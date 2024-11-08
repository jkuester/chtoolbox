import { Command } from '@effect/cli';
import { TestDataGeneratorService } from '../../services/test-data-generator';
export declare const generate: Command.Command<"generate", import("../../services/environment").EnvironmentService | Command.Command.Context<"chtx"> | TestDataGeneratorService, Error, {
    readonly designScriptPath: string;
}>;
//# sourceMappingURL=generate.d.ts.map