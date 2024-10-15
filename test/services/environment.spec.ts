import { describe, it } from 'mocha';
import { ConfigProvider, Effect, Either, Layer, pipe, Redacted, String, TestContext } from 'effect';
import { EnvironmentService } from '../../src/services/environment';
import { expect } from 'chai';

const BASE_URL = 'http://medic:password@hostlocal:5984/';
const URL_WITHOUT_SLASH = pipe(BASE_URL, String.slice(0, -1));
const URL_WITH_MEDIC = `${BASE_URL}medic`;

describe('Environment service', () => {
  const run = (
    config: [[string, string]]
  ) => (test:  Effect.Effect<unknown, unknown, EnvironmentService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(EnvironmentService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map(config))
      ))
    ));
  };

  it('stores updated url in shared Ref', run(
    [['COUCH_URL', BASE_URL]]
  )(Effect.gen(function* () {
    const updatedUrlBase = 'http://admin:12345@hostlocal:4443/';
    const updatedUrl = `${updatedUrlBase}medic/somethingelse`;

    const service = yield* EnvironmentService;
    const originalEnvironment = yield* service.get();
    const updatedEnvironment = yield* service.setUrl(Redacted.make(updatedUrl));
    const updatedEnvironment1 = yield* (yield* EnvironmentService).get();

    expect(originalEnvironment).to.deep.equal({
      url: Redacted.make(BASE_URL),
      user: 'medic'
    });
    expect(updatedEnvironment).to.deep.equal({
      url: Redacted.make(updatedUrlBase),
      user: 'admin'
    });
    expect(updatedEnvironment1).to.equal(updatedEnvironment);
  })));

  it('trims trailing /medic from url value', run(
    [['COUCH_URL', URL_WITH_MEDIC]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const env = yield* service.get();

    expect(env).to.deep.equal({
      url: Redacted.make(BASE_URL),
      user: 'medic'
    });
  })));

  it('trims trailing / from url value', run(
    [['COUCH_URL', URL_WITHOUT_SLASH]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const env = yield* service.get();

    expect(env).to.deep.equal({
      url: Redacted.make(BASE_URL),
      user: 'medic'
    });
  })));

  it('initializes with empty values if no COUCH_URL envar exists', run(
    [['NOT_COUCH_URL', BASE_URL]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const env = yield* service.get();

    expect(env).to.deep.equal({
      url: Redacted.make(String.empty),
      user: String.empty
    });
  })));

  it('throws an error when the COUCH_URL cannot be parsed', run(
    [['NOT_COUCH_URL', BASE_URL]]
  )(Effect.gen(function* () {
    const service = yield* EnvironmentService;
    const envEither = yield* Effect.either(service.setUrl(Redacted.make('not a url')));

    if (Either.isLeft(envEither)) {
      const error = envEither.left;
      expect(error.message).to.equal('Could not parse URL.');
    } else {
      expect.fail('Expected error to be thrown');
    }
  })));
});
