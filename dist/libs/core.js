import { Array, Effect, Function, Number, Option, Ref, Stream } from 'effect';
import PouchDB from 'pouchdb-core';
export const mapErrorToGeneric = (effect) => effect.pipe(Effect.mapError(x => x));
/**
 * Returns a function that takes an array. The function will return `false` until
 * it has been called `target` times with an empty array.
 * @param target the number of times the function will return `true` when called with
 * an empty array
 */
export const untilEmptyCount = (target) => Ref
    .unsafeMake(0)
    .pipe(countRef => Effect.fn((data) => countRef.pipe(Ref.get, Effect.map(Option.liftPredicate(() => Array.isEmptyArray(data))), Effect.map(Option.map(Number.increment)), Effect.map(Option.getOrElse(() => 0)), Effect.tap(count => countRef.pipe(Ref.set(count))), Effect.map(count => count === target))));
/**
 * Shim to make PouchDB easier to mock.
 */
export const pouchDB = (name, options) => new PouchDB(name, options);
const zipArrayStreams = (self, other) => Stream.zipAllWith(self, {
    other,
    onSelf: Function.identity,
    onOther: Function.identity,
    onBoth: (s, o) => [...s, ...o],
});
export const mergeArrayStreams = (streams) => Array
    .reduce(Array.drop(streams, 1), Array.headNonEmpty(streams), zipArrayStreams);
