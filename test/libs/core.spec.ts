import { describe, it } from 'mocha';
import { Chunk, Effect, Either, Stream, TestContext } from 'effect';
import { expect } from 'chai';
import { mapErrorToGeneric, mapStreamErrorToGeneric, mergeArrayStreams, untilEmptyCount } from '../../src/libs/core.ts';
import { SocketGenericError } from '@effect/platform/Socket';

describe('Core libs', () => {
  const run = (test:  Effect.Effect<void, Error>) => async () => {
    await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
  };

  it('mapErrorToGeneric', run(Effect.gen(function* () {
    const error = new SocketGenericError({ reason: 'Write', cause: 'error' });

    const either: Either.Either<void, Error> = yield* Effect
      .fail(error)
      .pipe(
        mapErrorToGeneric,
        Effect.either
      );

    if (Either.isRight(either)) {
      expect.fail('Expected error.');
    }

    expect(either.left).to.equal(error);
  })));

  it('mapStreamErrorToGeneric', run(Effect.gen(function* () {
    const error = new SocketGenericError({ reason: 'Write', cause: 'error' });

    const stream: Stream.Stream<void, Error> = Stream
      .fail(error)
      .pipe(mapStreamErrorToGeneric);
    const either = yield* stream.pipe(
      Stream.runDrain,
      Effect.either
    );

    if (Either.isRight(either)) {
      expect.fail('Expected error.');
    }

    expect(either.left).to.equal(error);
  })));

  it('untilEmptyCount', run(Effect.gen(function* () {
    const isArrayEmpty = untilEmptyCount(3);

    expect(yield* isArrayEmpty([1])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([1])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.true;
  })));

  it('mergeArrayStreams', run(Effect.gen(function* () {
    const mergedStream = mergeArrayStreams([
      Stream.make([1, 2, 3], [4, 5, 6], [7, 8, 9]),
      Stream.make([1], [2], [3]),
      Stream.make([1]),
      Stream.empty,
    ]);

    const data = Chunk.toReadonlyArray(yield* Stream.runCollect(mergedStream));

    expect(data).to.deep.equal([
      [1, 2, 3, 1, 1],
      [4, 5, 6, 2],
      [7, 8, 9, 3],
    ]);
  })));
});
