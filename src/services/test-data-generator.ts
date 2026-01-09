import { Effect, Option, pipe, Redacted } from 'effect';
import { Command } from '@effect/platform';
import { CommandExecutor, ExitCode } from '@effect/platform/CommandExecutor';
import * as Context from 'effect/Context';
import { fileURLToPath } from 'node:url';
import { CHT_URL_AUTHENTICATED } from '../libs/config.js';

// import.meta.resolve does not exist when packaged into cjs.
// So, this functionality is only available on esm.
const tdgPath = typeof import.meta.resolve === 'function'
  ? fileURLToPath(import.meta.resolve('test-data-generator'))
  : '';

const tdgCommand = Effect.fn((designScriptPath: string) => pipe(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  CHT_URL_AUTHENTICATED,
  Effect.flatMap(url => Command
    .make('node', tdgPath, designScriptPath)
    .pipe(
      Command.env({
        COUCH_URL: Redacted
          .value(url)
          .toString()
      }),
      Command.stdout('inherit'),
      Command.stderr('inherit'),
      Command.exitCode,
    ))
));

const serviceContext = pipe(
  CommandExecutor,
  Effect.map((commandExecutor) => Context.make(CommandExecutor, commandExecutor))
);

export class TestDataGeneratorService extends Effect.Service<TestDataGeneratorService>()(
  'chtoolbox/TestDataGeneratorService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      generate: Effect.fn((designScriptPath: string): Effect.Effect<ExitCode, Error> => tdgCommand(designScriptPath)
        .pipe(
          Effect.mapError(x => x as unknown as Error),
          Effect.map(Option.liftPredicate(exitCode => exitCode === 0)),
          Effect.map(Option.getOrThrow),
          Effect.provide(context),
        )),
    }))),
    accessors: true,
  }
) {
}
