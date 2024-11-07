import * as Effect from 'effect/Effect';
import { Stream } from 'effect';
import { EnvironmentService } from './environment';
export declare const assertPouchResponse: (value: PouchDB.Core.Response | PouchDB.Core.Error) => PouchDB.Core.Response;
type AllDocsOptions = PouchDB.Core.AllDocsWithKeyOptions | PouchDB.Core.AllDocsWithinRangeOptions | PouchDB.Core.AllDocsOptions;
export type AllDocsResponseStream = Stream.Stream<PouchDB.Core.AllDocsResponse<object>, Error>;
export declare const streamAllDocPages: (options?: AllDocsOptions) => (db: PouchDB.Database) => AllDocsResponseStream;
export declare const streamQueryPages: (viewIndex: string, options?: PouchDB.Query.Options<object, object>) => (db: PouchDB.Database) => Stream.Stream<PouchDB.Query.Response<object>>;
export declare const streamChanges: (options?: PouchDB.Core.ChangesOptions) => (db: PouchDB.Database) => Stream.Stream<PouchDB.Core.ChangesResponseChange<object>, Error>;
declare const PouchDBService_base: Effect.Service.Class<PouchDBService, "chtoolbox/PouchDBService", {
    readonly effect: Effect.Effect<{
        get: (dbName: string) => Effect.Effect<PouchDB.Database<object>, never, never>;
    }, never, EnvironmentService>;
    readonly accessors: true;
}>;
export declare class PouchDBService extends PouchDBService_base {
}
export {};
//# sourceMappingURL=pouchdb.d.ts.map