import * as Effect from 'effect/Effect';
import { AllDocsResponseStream, PouchDBService } from './pouchdb.js';
import { Option } from 'effect';
import { ChtClientService } from './cht-client.js';
declare const PurgeService_base: Effect.Service.Class<PurgeService, "chtoolbox/PurgeService", {
    readonly effect: Effect.Effect<{
        purgeAll: (dbName: string, purgeDdocs?: boolean) => Effect.Effect<AllDocsResponseStream, Error, never>;
        purgeReports: (dbName: string, opts: {
            since: Option.Option<Date>;
            before: Option.Option<Date>;
        }) => Effect.Effect<AllDocsResponseStream, Error, never>;
        purgeContacts: (dbName: string, type: string) => Effect.Effect<AllDocsResponseStream, Error, never>;
    }, never, ChtClientService | PouchDBService>;
    readonly accessors: true;
}>;
export declare class PurgeService extends PurgeService_base {
}
export {};
//# sourceMappingURL=purge.d.ts.map