import { Effect, Stream } from 'effect';
/**
 * Returns a function that takes an array. The function will return `false` until
 * it has been called `target` times with an empty array.
 * @param target the number of times the function will return `true` when called with
 * an empty array
 */
export declare const untilEmptyCount: (target: number) => (data: unknown[]) => Effect.Effect<boolean>;
/**
 * Shim to make PouchDB easier to mock.
 */
export declare const pouchDB: (name?: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database<object>;
export declare const mergeArrayStreams: <T, Q>(streams: Stream.Stream<T[], Error, Q>[]) => Stream.Stream<T[], Error, Q>;
//# sourceMappingURL=core.d.ts.map