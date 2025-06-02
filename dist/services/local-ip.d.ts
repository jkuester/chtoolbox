import { Effect, Option } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
declare const LocalIpService_base: Effect.Service.Class<LocalIpService, "chtoolbox/LocalIpService", {
    readonly effect: Effect.Effect<{
        create: (toPort: number, fromPort: Option.Option<number>) => Effect.Effect<number, Error>;
        rm: (toPort: number) => Effect.Effect<void, Error>;
        ls: () => Effect.Effect<{
            from: number;
            to: number;
        }[], Error>;
    }, never, CommandExecutor>;
    readonly accessors: true;
}>;
export declare class LocalIpService extends LocalIpService_base {
}
export {};
//# sourceMappingURL=local-ip.d.ts.map