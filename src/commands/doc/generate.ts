import { Args, Command } from '@effect/cli';
import { Effect } from 'effect';
import { initializeUrl } from '../../index.ts';
import { TestDataGeneratorService } from '../../services/test-data-generator.ts';

const designScriptPath = Args
  .path({ name: 'designScriptPath', exists: 'yes' })
  .pipe(
    Args.withDescription('Path to the design script to use.'),
  );

export const generate = Command
  .make('generate', { designScriptPath }, Effect.fn(({ designScriptPath }) => initializeUrl.pipe(
    Effect.andThen(TestDataGeneratorService.generate(designScriptPath)),
  )))
  .pipe(Command.withDescription('Generate docs using https://github.com/medic/test-data-generator.'));
