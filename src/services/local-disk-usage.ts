import { Command } from '@effect/platform';
import { Effect, Layer, pipe } from 'effect';
import * as Context from 'effect/Context';
import { PlatformError } from '@effect/platform/Error';
import { CommandExecutor } from '@effect/platform/CommandExecutor';

export interface LocalDiskUsageService {
  readonly getSize: (path: string) => Effect.Effect<number, PlatformError, CommandExecutor>
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

export const LocalDiskUsageServiceLive = Layer.succeed(LocalDiskUsageService, LocalDiskUsageService.of({
  getSize: path => pipe(path, duCommand)
}));
