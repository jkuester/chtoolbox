import { Effect, Layer } from 'effect';
import * as Context from 'effect/Context';
import { PlatformError } from '@effect/platform/Error';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
export interface LocalDiskUsageService {
    readonly getSize: (path: string) => Effect.Effect<number, PlatformError, CommandExecutor>;
}
export declare const LocalDiskUsageService: Context.Tag<LocalDiskUsageService, LocalDiskUsageService>;
export declare const LocalDiskUsageServiceLive: Layer.Layer<LocalDiskUsageService, never, never>;
//# sourceMappingURL=local-disk-usage.d.ts.map