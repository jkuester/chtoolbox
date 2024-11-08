import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
import { HttpClientResponseEffect } from '../../libs/core';
declare const ChtUpgradeService_base: Effect.Service.Class<ChtUpgradeService, "chtoolbox/ChtUpgradeService", {
    readonly effect: Effect.Effect<{
        upgrade: (version: string) => HttpClientResponseEffect;
        stage: (version: string) => HttpClientResponseEffect;
        complete: (version: string) => HttpClientResponseEffect | Effect.Effect<void, Error>;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class ChtUpgradeService extends ChtUpgradeService_base {
}
export {};
//# sourceMappingURL=upgrade.d.ts.map