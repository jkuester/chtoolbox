import * as Effect from 'effect/Effect';
import { Stream } from 'effect';
import { EnvironmentService } from './environment';
export declare const assertPouchResponse: (value: PouchDB.Core.Response | PouchDB.Core.Error) => PouchDB.Core.Response;
type AllDocsOptions = PouchDB.Core.AllDocsWithKeyOptions | PouchDB.Core.AllDocsWithinRangeOptions | PouchDB.Core.AllDocsOptions;
export declare const streamAllDocPages: (options?: AllDocsOptions) => (db: PouchDB.Database) => Stream.Stream<PouchDB.Core.AllDocsResponse<object>, never, never>;
export declare const streamQueryPages: (viewIndex: string, options?: PouchDB.Query.Options<object, object>) => (db: PouchDB.Database) => Stream.Stream<PouchDB.Query.Response<object>, never, never>;
declare const PouchDBService_base: Effect.Service.Class<PouchDBService, "chtoolbox/PouchDBService", {
    readonly effect: Effect.Effect<{
        get: (dbName: string) => Effect.Effect<PouchDB.Database<{}>, never, never>;
    }, never, EnvironmentService>;
    readonly accessors: true;
}>;
export declare class PouchDBService extends PouchDBService_base {
}
export {};
//# sourceMappingURL=pouchdb.d.ts.map