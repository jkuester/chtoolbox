import { Command } from '@effect/cli';
import { TestDataGeneratorService } from '../../services/test-data-generator.js';
export declare const generate: Command.Command<"generate", Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService | TestDataGeneratorService, Error, {
    readonly designScriptPath: string;
}>;
//# sourceMappingURL=generate.d.ts.map