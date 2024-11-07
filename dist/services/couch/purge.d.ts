import { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../cht-client';
import { NonEmptyArray } from 'effect/Array';
import { HttpClientResponseEffect } from '../../libs/core';
import RemoveDocument = PouchDB.Core.RemoveDocument;
declare const CouchPurgeService_base: Effect.Service.Class<CouchPurgeService, "chtoolbox/CouchPurgeService", {
    readonly effect: Effect.Effect<{
        purge: (dbName: string, docs: NonEmptyArray<RemoveDocument>) => HttpClientResponseEffect;
    }, never, ChtClientService>;
    readonly accessors: true;
}>;
export declare class CouchPurgeService extends CouchPurgeService_base {
}
export declare const purgeFrom: (dbName: string) => (docs: NonEmptyArray<RemoveDocument>) => Effect.Effect<HttpClientResponse, Error, CouchPurgeService>;
export {};
//# sourceMappingURL=purge.d.ts.map