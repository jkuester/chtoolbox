import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
export declare const compactDb: (dbName: string) => Effect.Effect<void, Error, ChtClientService>;
export declare const compactDesign: (dbName: string, designName: string) => Effect.Effect<void, Error, ChtClientService>;
//# sourceMappingURL=compact.d.ts.map