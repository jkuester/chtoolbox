import sinon from 'sinon';
import { Effect, Layer, TestContext } from 'effect';
import { YieldWrap } from 'effect/Utils';
import { Scope } from 'effect/Scope';
import { use } from 'chai';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';

use(deepEqualInAnyOrder);

/**
 * Sandbox to use when creating stand-alone stubs. This sandbox will be `reset` after each test, but not `restore`d.
 * For some reason, restoring a sandbox does weird things to stand-alone stubs. Do NOT use this sandbox to stub
 * functions on existing objects. This is only for creating stand-alone stubs.
 */
export const sandbox = sinon.createSandbox();

export const genWithLayer = <T>(layer: Layer.Layer<T, unknown>) => (
  generator: () => Generator<YieldWrap<Effect.Effect<unknown, unknown, T | Scope>>>
) => (): Promise<unknown> => Effect.runPromise(Effect
  .gen(generator)
  .pipe(
    Effect.provide(layer),
    Effect.provide(TestContext.TestContext),
    Effect.scoped,
  ));

export const mochaHooks = {
  afterEach(): void {
    sandbox.reset();
    sinon.restore();
  },
};
