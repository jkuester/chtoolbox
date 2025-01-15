import { Effect, Option, Redacted } from 'effect';
import { Command } from '@effect/platform';
import { EnvironmentService } from './environment.js';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import * as Context from 'effect/Context';
const tdgPath = require.resolve('test-data-generator');
const tdgCommand = (designScriptPath) => EnvironmentService
    .get()
    .pipe(Effect.flatMap(env => Command
    .make('node', tdgPath, designScriptPath)
    .pipe(Command.env({ COUCH_URL: Redacted.value(env.url) }), Command.stdout('inherit'), Command.stderr('inherit'), Command.exitCode)));
const serviceContext = Effect
    .all([
    EnvironmentService,
    CommandExecutor,
])
    .pipe(Effect.map(([environmentSvc, commandExecutor,]) => Context
    .make(CommandExecutor, commandExecutor)
    .pipe(Context.add(EnvironmentService, environmentSvc))));
export class TestDataGeneratorService extends Effect.Service()('chtoolbox/TestDataGeneratorService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        generate: (designScriptPath) => tdgCommand(designScriptPath)
            .pipe(Effect.mapError(x => x), Effect.map(Option.liftPredicate(exitCode => exitCode === 0)), Effect.map(Option.getOrThrow), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=test-data-generator.js.map