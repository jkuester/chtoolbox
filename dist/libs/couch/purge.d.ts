import { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';
import { NonEmptyArray } from 'effect/Array';
import RemoveDocument = PouchDB.Core.RemoveDocument;
export declare const purgeFrom: (dbName: string) => (docs: NonEmptyArray<RemoveDocument>) => Effect.Effect<HttpClientResponse, Error, ChtClientService>;
//# sourceMappingURL=purge.d.ts.map