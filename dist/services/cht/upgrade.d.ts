import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
declare const ChtUpgradeService_base: Effect.Service.Class<ChtUpgradeService, "chtoolbox/ChtUpgradeService", {
    readonly effect: Effect.Effect<{
        upgrade: (version: string) => Effect.Effect<import("@effect/platform/HttpClientResponse").HttpClientResponse, Error, never>;
        stage: (version: string) => Effect.Effect<import("@effect/platform/HttpClientResponse").HttpClientResponse, Error, never>;
        complete: (version: string) => Effect.Effect<void | import("@effect/platform/HttpClientResponse").HttpClientResponse, Error, never>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class ChtUpgradeService extends ChtUpgradeService_base {
}
export {};
//# sourceMappingURL=upgrade.d.ts.map