import { describe, it } from 'mocha';
import { Config, ConfigProvider, Effect, Layer, Redacted, Ref, TestContext } from 'effect';
import { EnvironmentService, EnvironmentServiceLive } from '../../src/services/environment';
import { expect } from 'chai';

const BASE_URL = 'http://medic:password@hostlocal:5984';
const URL_WITH_MEDIC = `${BASE_URL}/medic`;

describe('Environment service', () => {
  const run = (
    config: [[string, string]]
  ) => (test:  Effect.Effect<unknown, unknown, EnvironmentService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(EnvironmentServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map(config))
      ))
    ));
  };

  it('loads url from COUCH_URL envar', run(
    [['COUCH_URL', BASE_URL]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const urlConfig = yield* Ref.get(service.get().url);
    const urlValue = yield* urlConfig.pipe(Config.map(Redacted.value));

    expect(urlValue).to.equal(BASE_URL);
  })));

  it('loads url from updated Ref', run(
    [['COUCH_URL', BASE_URL]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    yield* Ref.update(service.get().url, () => Config.succeed(Redacted.make(URL_WITH_MEDIC)));

    const urlConfig = yield* Ref.get(service.get().url);
    const urlValue = yield* urlConfig.pipe(Config.map(Redacted.value));
    expect(urlValue).to.equal(URL_WITH_MEDIC);
  })));

  it('trims trailing /medic from url value loaded from COUCH_URL', run(
    [['COUCH_URL', URL_WITH_MEDIC]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const urlConfig = yield* Ref.get(service.get().url);
    const urlValue = yield* urlConfig.pipe(Config.map(Redacted.value));

    expect(urlValue).to.equal(BASE_URL);
  })));
});
