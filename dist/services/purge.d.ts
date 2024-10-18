import * as Effect from 'effect/Effect';
import { PouchDBService } from './pouchdb';
import { Stream } from 'effect';
import { CouchPurgeService } from './couch/purge';
import AllDocsResponse = PouchDB.Core.AllDocsResponse;
declare const PurgeService_base: Effect.Service.Class<PurgeService, "chtoolbox/PurgeService", {
    readonly effect: Effect.Effect<{
        purgeAll: (dbName: string, purgeDdocs?: boolean) => Effect.Effect<Stream.Stream<AllDocsResponse<object>, Error, CouchPurgeService>, never, never>;
    }, never, PouchDBService | CouchPurgeService>;
    readonly accessors: true;
}>;
export declare class PurgeService extends PurgeService_base {
}
export {};
//# sourceMappingURL=purge.d.ts.map