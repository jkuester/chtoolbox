import * as Effect from 'effect/Effect';
import { Option, Stream } from 'effect';
import { EnvironmentService } from './environment.js';
import { UnknownException } from 'effect/Cause';
type AllDocsOptions = PouchDB.Core.AllDocsWithKeyOptions | PouchDB.Core.AllDocsWithinRangeOptions | PouchDB.Core.AllDocsOptions | PouchDB.Core.AllDocsWithKeysOptions;
export type AllDocsResponseStream = Stream.Stream<PouchDB.Core.AllDocsResponse<object>, Error>;
export declare const streamAllDocPages: (dbName: string) => (options?: AllDocsOptions) => Effect.Effect<AllDocsResponseStream, never, PouchDBService>;
type Doc = PouchDB.Core.AllDocsMeta & PouchDB.Core.IdMeta & PouchDB.Core.RevisionIdMeta;
// export const getAllDocs = (dbName: string) => (
//   options: AllDocsOptions = {}
// ): Effect.Effect<Doc[], never, PouchDBService> => PouchDBService
//   .get(dbName)
//   .pipe(
//     Effect.flatMap(db => allDocs(db, { ...options, include_docs: true })),
//     Effect.map(({ rows }) => rows),
//     Effect.map(Array.map(({ doc }) => doc)),
//     Effect.map(Array.filter(Predicate.isNotNullable)),
//   );
// const bulkDocs = (dbName: string) => (
//   docs: PouchDB.Core.PutDocument<object>[]
// ) => PouchDBService
//     .get(dbName)
//     .pipe(
//       Effect.flatMap(db => Effect.promise(() => db.bulkDocs(docs))),
//       Effect.map(Array.map(getPouchResponse)),
//       Effect.flatMap(Effect.all),
//     );
//
// export const deleteDocs = (dbName: string) => (
//   docs: NonEmptyArray<Doc>
// ): Effect.Effect<PouchDB.Core.Response[], PouchDB.Core.Error, PouchDBService> => pipe(
//   docs,
//   Array.map(doc => ({ ...doc, _deleted: true })),
//   bulkDocs(dbName),
// );
export declare const saveDoc: (dbName: string) => (doc: object) => Effect.Effect<PouchDB.Core.Response, PouchDB.Core.Error, PouchDBService>;
export declare const getDoc: (dbName: string) => (id: string) => Effect.Effect<Option.Option<Doc>, UnknownException, PouchDBService>;
export declare const streamQueryPages: (dbName: string, viewIndex: string) => (options?: PouchDB.Query.Options<object, object>) => Effect.Effect<Stream.Stream<PouchDB.Query.Response<object>, never, never>, never, PouchDBService>;
export declare const streamChanges: (dbName: string) => (options?: PouchDB.Core.ChangesOptions | undefined) => Effect.Effect<Stream.Stream<PouchDB.Core.ChangesResponseChange<object>, Error, never>, never, PouchDBService>;
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