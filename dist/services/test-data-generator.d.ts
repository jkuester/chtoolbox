import { Effect } from 'effect';
import { EnvironmentService } from './environment.js';
import { CommandExecutor, ExitCode } from '@effect/platform/CommandExecutor';
declare const TestDataGeneratorService_base: Effect.Service.Class<TestDataGeneratorService, "chtoolbox/TestDataGeneratorService", {
    readonly effect: Effect.Effect<{
        generate: (designScriptPath: string) => Effect.Effect<ExitCode, Error>;
    }, never, EnvironmentService | CommandExecutor>;
    readonly accessors: true;
}>;
export declare class TestDataGeneratorService extends TestDataGeneratorService_base {
}
export {};
//# sourceMappingURL=test-data-generator.d.ts.map