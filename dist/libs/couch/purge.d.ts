import { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import RemoveDocument = PouchDB.Core.RemoveDocument;
export declare const purgeFrom: (dbName: string) => (docs: [RemoveDocument, ...RemoveDocument[]]) => Effect.Effect<HttpClientResponse, Error, ChtClientService>;
//# sourceMappingURL=purge.d.ts.map