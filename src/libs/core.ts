import { Array, Effect, Function, Number, Option, Ref, Stream } from 'effect';
import PouchDB from 'pouchdb-core';

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

/**
 * Wrapper for `get-port` ES Module.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const promisedGetPort = () => import('get-port');

const zipArrayStreams = <T, Q>(
  self: Stream.Stream<T[], Error, Q>,
  other: Stream.Stream<T[], Error, Q>
) => Stream.zipAllWith(self, {
    other,
    onSelf: Function.identity,
    onOther: Function.identity,
    onBoth: (s, o) => [...s, ...o],
  });

export const mergeArrayStreams = <T, Q>(streams: Stream.Stream<T[], Error, Q>[]): Stream.Stream<T[], Error, Q> => Array
  .reduce(streams.slice(1), streams[0], zipArrayStreams);
