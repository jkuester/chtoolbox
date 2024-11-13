import { Effect, Option, Redacted } from 'effect';
import { Command } from '@effect/platform';
import { EnvironmentService } from './environment';
import { CommandExecutor, ExitCode } from '@effect/platform/CommandExecutor';
import * as Context from 'effect/Context';

const tdgPath = require.resolve('test-data-generator');

const tdgCommand = (designScriptPath: string) => EnvironmentService
  .get()
  .pipe(Effect.flatMap(env => Command
    .make('node', tdgPath, designScriptPath)
    .pipe(
      Command.env({ COUCH_URL: Redacted.value(env.url) }),
      Command.stdout('inherit'),
      Command.stderr('inherit'),
      Command.exitCode,
    )));

const serviceContext = Effect
  .all([
    EnvironmentService,
    CommandExecutor,
  ])
  .pipe(Effect.map(([
    environmentSvc,
    commandExecutor,
  ]) => Context
    .make(CommandExecutor, commandExecutor)
    .pipe(
      Context.add(EnvironmentService, environmentSvc),
    )));

export class TestDataGeneratorService extends Effect.Service<TestDataGeneratorService>()(
  'chtoolbox/TestDataGeneratorService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      generate: (designScriptPath: string): Effect.Effect<ExitCode, Error> => tdgCommand(designScriptPath)
        .pipe(
          Effect.mapError(x => x as unknown as Error),
          Effect.map(Option.liftPredicate(exitCode => exitCode === 0)),
          Effect.map(Option.getOrThrow),
          Effect.provide(context),
        ),
    }))),
    accessors: true,
  }
) {
}
