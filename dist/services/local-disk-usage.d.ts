import { Effect } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';
declare const LocalDiskUsageService_base: Effect.Service.Class<LocalDiskUsageService, "chtoolbox/LocalDiskUsageService", {
    readonly effect: Effect.Effect<{
        getSize: (path: string) => Effect.Effect<number, Error | PlatformError, never>;
    }, never, CommandExecutor>;
    readonly accessors: true;
}>;
export declare class LocalDiskUsageService extends LocalDiskUsageService_base {
}
export {};
//# sourceMappingURL=local-disk-usage.d.ts.map