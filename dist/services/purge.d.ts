import * as Effect from 'effect/Effect';
import { AllDocsResponseStream, PouchDBService } from './pouchdb';
import { Option } from 'effect';
import { CouchPurgeService } from './couch/purge';
declare const PurgeService_base: Effect.Service.Class<PurgeService, "chtoolbox/PurgeService", {
    readonly effect: Effect.Effect<{
        purgeAll: (dbName: string, purgeDdocs?: boolean) => Effect.Effect<AllDocsResponseStream, Error>;
        purgeReports: (dbName: string, opts: {
            since: Option.Option<Date>;
            before: Option.Option<Date>;
        }) => Effect.Effect<AllDocsResponseStream, Error>;
        purgeContacts: (dbName: string, type: string) => Effect.Effect<AllDocsResponseStream, Error>;
    }, never, PouchDBService | CouchPurgeService>;
    readonly accessors: true;
}>;
export declare class PurgeService extends PurgeService_base {
}
export {};
//# sourceMappingURL=purge.d.ts.map