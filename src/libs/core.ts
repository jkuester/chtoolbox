import { Array, Console, Effect, Function, Number, Option, pipe, Ref, Stream } from 'effect';
import PouchDB from 'pouchdb-core';
import { HttpClientResponse } from '@effect/platform';

export type HttpClientResponseEffect = Effect.Effect<HttpClientResponse.HttpClientResponse, Error>;

/**
 * Returns a function that takes an array. The function will return `false` until
 * it has been called `target` times with an empty array.
 * @param target the number of times the function will return `true` when called with
 * an empty array
 */
export const untilEmptyCount = (target: number): (data: unknown[]) => Effect.Effect<boolean> => Ref
  .unsafeMake(0)
  .pipe(
    countRef => (data: unknown[]) => countRef.pipe(
      Ref.get,
      Effect.map(Option.liftPredicate(() => Array.isEmptyArray(data))),
      Effect.map(Option.map(Number.increment)),
      Effect.map(Option.getOrElse(() => 0)),
      Effect.tap(count => countRef.pipe(Ref.set(count))),
      Effect.map(count => count === target),
    ),
  );

/**
 * Shim to make PouchDB easier to mock.
 */
export const pouchDB = (
  name?: string,
  options?: PouchDB.Configuration.DatabaseConfiguration
): PouchDB.Database<object> => new PouchDB(name, options);

const zipArrayStreams = <T>(
  self: Stream.Stream<T[], Error>,
  other: Stream.Stream<T[], Error>
) => Stream.zipAllWith(self, {
    other,
    onSelf: Function.identity,
    onOther: Function.identity,
    onBoth: (s, o) => [...s, ...o],
  });

export const mergeArrayStreams = <T>(streams: Stream.Stream<T[], Error>[]): Stream.Stream<T[], Error> => Array
  .reduce(streams.slice(1), streams[0], zipArrayStreams);

export const clearThen = (
  printEffect: Effect.Effect<void>
): Effect.Effect<void> => Console.clear.pipe(Effect.tap(printEffect));

export const logJson = (data: unknown): Effect.Effect<void> => pipe(
  JSON.stringify(data, null, 2),
  Console.log
);
