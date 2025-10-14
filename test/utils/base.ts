import sinon from 'sinon';
import { ConfigProvider, Effect, Layer, pipe, TestContext } from 'effect';
import { YieldWrap } from 'effect/Utils';
import { Scope } from 'effect/Scope';
import { use } from 'chai';
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
import chaiExclude from 'chai-exclude';
import sinonChai from 'sinon-chai';

use(deepEqualInAnyOrder);
use(chaiExclude);
use(sinonChai);

export const DEFAULT_CHT_URL = 'http://localhost:5988/';
export const DEFAULT_CHT_USERNAME = 'medic';
export const DEFAULT_CHT_PASSWORD = 'password';
export const DEFAULT_CHT_URL_AUTH = `http://medic:password@localhost:5988/`;

/**
 * Sandbox to use when creating stand-alone stubs. This sandbox will be `reset` after each test, but not `restore`d.
 * For some reason, restoring a sandbox does weird things to stand-alone stubs. Do NOT use this sandbox to stub
 * functions on existing objects. This is only for creating stand-alone stubs.
 */
export const sandbox = sinon.createSandbox();

type GenRunner<T> = (
  generator: () => Generator<YieldWrap<Effect.Effect<unknown, unknown, T | Scope>>, unknown>
) => () => Promise<unknown>;

export const genWithLayer =
  <T>(layer: Layer.Layer<T, unknown>): GenRunner<T> =>
    (generator: () => Generator<YieldWrap<Effect.Effect<unknown, unknown, T | Scope>>>) =>
      (): Promise<unknown> => Effect.runPromise(Effect
        .gen(generator)
        .pipe(
          Effect.provide(layer),
          Effect.provide(TestContext.TestContext),
          Effect.scoped,
        ));

export const genWithConfig = <T>(layer: Layer.Layer<T, unknown>) => (
  config: [string, string][]
): GenRunner<T> => pipe(
  layer,
  Layer.provide(Layer.setConfigProvider(
    ConfigProvider.fromMap(new Map(config))
  )),
  genWithLayer,
);

export const genWithDefaultConfig = <T>(layer: Layer.Layer<T, unknown>): GenRunner<T> => genWithConfig(layer)([
  ['CHT_URL', DEFAULT_CHT_URL],
  ['CHT_USERNAME', DEFAULT_CHT_USERNAME],
  ['CHT_PASSWORD', DEFAULT_CHT_PASSWORD]
]);

export const mochaHooks = {
  afterEach(): void {
    sandbox.reset();
    sinon.restore();
  },
};
