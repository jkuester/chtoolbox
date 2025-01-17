import { Command } from '@effect/cli';
import { TestDataGeneratorService } from '../../services/test-data-generator.js';
export declare const generate: Command.Command<"generate", import("../../services/environment.js").EnvironmentService | Command.Command.Context<"chtx"> | TestDataGeneratorService, Error, {
    readonly designScriptPath: string;
}>;
//# sourceMappingURL=generate.d.ts.map