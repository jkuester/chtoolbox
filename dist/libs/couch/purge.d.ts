import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
export declare const purgeFrom: (dbName: string) => (docs: [PouchDB.Core.RemoveDocument, ...PouchDB.Core.RemoveDocument[]]) => Effect.Effect<HttpClientResponse, Error, ChtClientService>;
//# sourceMappingURL=purge.d.ts.map