import { describe, it } from 'mocha';
import { Effect, Option, Ref, TestContext } from 'effect';
import { expect } from 'chai';
import { optionalUpdate } from '../../src/libs/core';

describe('Warm Views Service', () => {
  const run = (test:  Effect.Effect<void>) => async () => {
    await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
  };

  it('updates the ref when the option has some value', run(Effect.gen(function* () {
    const stringRef = yield* Ref.make('hello');
    const stringOpt = Option.some('world');

    yield* optionalUpdate(stringRef, stringOpt);
    const updatedValue = yield* Ref.get(stringRef);

    expect(updatedValue).to.equal('world');
  })));

  it('does not update the ref when the option has none', run(Effect.gen(function* () {
    const stringRef = yield* Ref.make('hello');
    const stringOpt = Option.none();

    yield* optionalUpdate(stringRef, stringOpt);
    const updatedValue = yield* Ref.get(stringRef);

    expect(updatedValue).to.equal('hello');
  })));
});
