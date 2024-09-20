import { Command } from '@effect/platform';
import { Effect, Layer, pipe } from 'effect';
import * as Context from 'effect/Context';
import { PlatformError } from '@effect/platform/Error';
import { CommandExecutor } from '@effect/platform/CommandExecutor';

export interface LocalDiskUsageService {
  readonly getSize: (path: string) => Effect.Effect<number, PlatformError>
}

export const LocalDiskUsageService = Context.GenericTag<LocalDiskUsageService>('chtoolbox/LocalDiskUsageService');

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

const ServiceContext = CommandExecutor.pipe(Effect.map(executor => Context.make(CommandExecutor, executor)));

export const LocalDiskUsageServiceLive = Layer.effect(LocalDiskUsageService, ServiceContext.pipe(Effect.map(
  context => LocalDiskUsageService.of({
    getSize: path => duCommand(path).pipe(
      Effect.provide(context)
    ),
  })
)));
