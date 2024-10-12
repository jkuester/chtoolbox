import { Array, Effect, Number, Option, Ref } from 'effect';
import PouchDB from 'pouchdb-core';

/**
 * Returns a function that takes an array. The function will return `false` until
 * it has been called `target` times with an empty array.
 * @param target the number of times the function will return `true` when called with
 * an empty array
 */
export const untilEmptyCount = (target: number) => Ref
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
) => new PouchDB(name, options);
