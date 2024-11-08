import { Command } from '@effect/platform';
import { Effect, pipe } from 'effect';
import * as Context from 'effect/Context';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';

const parseSize = (output: string) => pipe(
  output.split(/\s/)[0],
  parseInt
);

const duCommand = (path: string) => Command
  .make('du', '-s', path)
  .pipe(
    Command.string,
    Effect.map(parseSize),
  );

const serviceContext = CommandExecutor.pipe(Effect.map(executor => Context.make(CommandExecutor, executor)));

export class LocalDiskUsageService extends Effect.Service<LocalDiskUsageService>()('chtoolbox/LocalDiskUsageService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    getSize: (path: string): Effect.Effect<number, Error | PlatformError> => duCommand(path)
      .pipe(Effect.provide(context)),
  }))),
  accessors: true,
}) {
}
