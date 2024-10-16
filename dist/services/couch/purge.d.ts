import * as Effect from 'effect/Effect';
import { CouchService } from './couch';
import { NonEmptyArray } from 'effect/Array';
import RemoveDocument = PouchDB.Core.RemoveDocument;
declare const CouchPurgeService_base: Effect.Service.Class<CouchPurgeService, "chtoolbox/CouchPurgeService", {
    readonly effect: Effect.Effect<{
        purge: (dbName: string, docs: NonEmptyArray<RemoveDocument>) => Effect.Effect<import("@effect/platform/HttpClientResponse").HttpClientResponse, Error, never>;
    }, never, CouchService>;
    readonly accessors: true;
}>;
export declare class CouchPurgeService extends CouchPurgeService_base {
}
export declare const purgeFrom: (dbName: string) => (docs: NonEmptyArray<RemoveDocument>) => Effect.Effect<import("@effect/platform/HttpClientResponse").HttpClientResponse, Error, CouchPurgeService>;
export {};
//# sourceMappingURL=purge.d.ts.map