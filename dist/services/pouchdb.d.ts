import * as Effect from 'effect/Effect';
import { Option, Stream } from 'effect';
import { EnvironmentService } from './environment.js';
import { UnknownException } from 'effect/Cause';
type AllDocsOptions = PouchDB.Core.AllDocsWithKeyOptions | PouchDB.Core.AllDocsWithinRangeOptions | PouchDB.Core.AllDocsOptions | PouchDB.Core.AllDocsWithKeysOptions;
export type AllDocsResponseStream = Stream.Stream<PouchDB.Core.AllDocsResponse<object>, Error>;
export declare const streamAllDocPages: (dbName: string) => (options?: AllDocsOptions) => Effect.Effect<AllDocsResponseStream, never, PouchDBService>;
type Doc = PouchDB.Core.AllDocsMeta & PouchDB.Core.IdMeta & PouchDB.Core.RevisionIdMeta;
export declare const saveDoc: (dbName: string) => (doc: object) => Effect.Effect<PouchDB.Core.Response, PouchDB.Core.Error, PouchDBService>;
export declare const getDoc: (dbName: string) => (id: string) => Effect.Effect<Option.Option<Doc>, UnknownException, PouchDBService>;
export declare const streamQueryPages: (dbName: string, viewIndex: string) => (options?: PouchDB.Query.Options<object, object>) => Effect.Effect<Stream.Stream<PouchDB.Query.Response<object>>, never, PouchDBService>;
export declare const streamChanges: (dbName: string) => (options?: PouchDB.Core.ChangesOptions) => Effect.Effect<Stream.Stream<PouchDB.Core.ChangesResponseChange<object>, Error>, never, PouchDBService>;
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