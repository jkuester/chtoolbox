import { Effect, Option, Ref } from 'effect';
export declare const optionalUpdate: <A>(ref: Ref.Ref<A>, value: Option.Option<A>) => Effect.Effect<void>;
/**
 * Shim to make PouchDB easier to mock.
 */
export declare const pouchDB: (name?: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database<{}>;
//# sourceMappingURL=core.d.ts.map