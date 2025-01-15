import { Args, Command } from '@effect/cli';
import { Effect } from 'effect';
import { initializeUrl } from '../../index.js';
import { TestDataGeneratorService } from '../../services/test-data-generator.js';
const designScriptPath = Args
    .path({ name: 'designScriptPath', exists: 'yes' })
    .pipe(Args.withDescription('Path to the design script to use.'));
export const generate = Command
    .make('generate', { designScriptPath }, ({ designScriptPath }) => initializeUrl.pipe(Effect.andThen(TestDataGeneratorService.generate(designScriptPath))))
    .pipe(Command.withDescription('Generate docs using https://github.com/medic/test-data-generator.'));
//# sourceMappingURL=generate.js.map