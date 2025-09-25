import { Array, Effect, Function, Number, Option, Ref, Stream } from 'effect';

export const mapErrorToGeneric = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, Error, R> => effect.pipe(Effect.mapError(x => x as unknown as Error));

export const mapStreamErrorToGeneric = <A, E, R>(
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, Error, R> => stream.pipe(Stream.mapError(x => x as unknown as Error));

/**
 * Returns a function that takes an array. The function will return `false` until
 * it has been called `target` times with an empty array.
 * @param target the number of times the function will return `true` when called with
 * an empty array
 */
export const untilEmptyCount = (target: number): (data: unknown[]) => Effect.Effect<boolean> => Ref
  .unsafeMake(0)
  .pipe(
    countRef => Effect.fn((data: unknown[]) => countRef.pipe(
      Ref.get,
      Effect.map(Option.liftPredicate(() => Array.isEmptyArray(data))),
      Effect.map(Option.map(Number.increment)),
      Effect.map(Option.getOrElse(() => 0)),
      Effect.tap(count => countRef.pipe(Ref.set(count))),
      Effect.map(count => count === target),
    )),
  );

const zipArrayStreams = <T, Q>(
  self: Stream.Stream<T[], Error, Q>,
  other: Stream.Stream<T[], Error, Q>
) => Stream.zipAllWith(self, {
    other,
    onSelf: Function.identity,
    onOther: Function.identity,
    onBoth: (s, o) => [...s, ...o],
  });

export const mergeArrayStreams = <T, Q>(
  streams: [Stream.Stream<T[], Error, Q>, ...Stream.Stream<T[], Error, Q>[]]
): Stream.Stream<T[], Error, Q> => Array
    .reduce(
      Array.drop(streams, 1),
      Array.headNonEmpty(streams),
      zipArrayStreams
    );
