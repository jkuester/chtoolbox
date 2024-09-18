import { describe, it } from 'mocha';
import { Config, ConfigProvider, Effect, Layer, Redacted, Ref } from 'effect';
import { EnvironmentService, EnvironmentServiceLive } from '../../src/services/environment';
import { expect } from 'chai';
import { ConfigError } from 'effect/ConfigError';

const BASE_URL = 'http://medic:password@hostlocal:5984';
const URL_WITH_MEDIC = `${BASE_URL}/medic`;

const mockConfigLayer = (config: readonly [string, string][]) => Layer.setConfigProvider(
  ConfigProvider.fromMap(new Map(config))
);

const run = <T> (depLayer: Layer.Layer<T>) => (test: Effect.Effect<void, ConfigError, EnvironmentService>) => () => {
  Effect.runSync(test.pipe(
    Effect.provide(EnvironmentServiceLive),
    Effect.provide(depLayer)
  ));
};

describe('Environment service', () => {
  it('loads url from COUCH_URL envar', run(
    mockConfigLayer([['COUCH_URL', BASE_URL]])
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const urlConfig = yield* Ref.get(service.url);
    const urlValue = yield* urlConfig.pipe(Config.map(Redacted.value))

    expect(urlValue).to.equal(BASE_URL);
  })));

  it('loads url from updated Ref', run(
    mockConfigLayer([['COUCH_URL', BASE_URL]])
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    yield* Ref.update(service.url, () => Config.succeed(Redacted.make(URL_WITH_MEDIC)));

    const urlConfig = yield* Ref.get(service.url);
    const urlValue = yield* urlConfig.pipe(Config.map(Redacted.value))
    expect(urlValue).to.equal(URL_WITH_MEDIC);
  })));

  it('trims trailing /medic from url value loaded from COUCH_URL', run(
    mockConfigLayer([['COUCH_URL', URL_WITH_MEDIC]])
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const urlConfig = yield* Ref.get(service.url);
    const urlValue = yield* urlConfig.pipe(Config.map(Redacted.value))

    expect(urlValue).to.equal(BASE_URL);
  })));
});
