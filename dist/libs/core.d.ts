import { Effect, Stream } from 'effect';
import { HttpClientResponse } from '@effect/platform';
export type HttpClientResponseEffect = Effect.Effect<HttpClientResponse.HttpClientResponse, Error>;
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
export declare const mergeArrayStreams: <T>(streams: Stream.Stream<T[], Error>[]) => Stream.Stream<T[], Error>;
export declare const clearThen: (printEffect: Effect.Effect<void>) => Effect.Effect<void>;
export declare const logJson: (data: unknown) => Effect.Effect<void>;
//# sourceMappingURL=core.d.ts.map