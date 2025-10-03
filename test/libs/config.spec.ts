import { describe, it } from 'mocha';
import { Config, ConfigProvider, Effect, Either, Layer, pipe, Redacted } from 'effect';
import { expect } from 'chai';
import * as ConfigLibs from '../../src/libs/config.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';
import { FileSystem } from '@effect/platform';

const run = (config: [string, string][]) => genWithLayer(
  Layer.setConfigProvider(ConfigProvider.fromMap(new Map(config)))
);

const readJsonFile = sandbox.stub();

const {
  GITHUB_TOKEN,
  configProviderEffect
} = await esmock<typeof ConfigLibs>('../../src/libs/config.ts', {
  '../../src/libs/file.ts': { readJsonFile }
});

describe('Config libs', () => {
  it('configProviderEffect - loads config from JSON file', () => {
    readJsonFile.returns(Effect.succeed({ CHTOOLBOX_TEST_VAL: 'hello world'}));

    const configProvider = Effect.runSync(pipe(
      configProviderEffect,
      Effect.provide(Layer.succeed(FileSystem.FileSystem, {} as unknown as FileSystem.FileSystem))
    ));

    const result = Effect.runSync(pipe(
      Config.string('CHTOOLBOX_TEST_VAL'),
      Effect.withConfigProvider(configProvider)
    ));

    expect(result).to.equal('hello world');
  });

  describe('GITHUB_TOKEN', () => {
    it('returns redacted github token when provided', run(
      [['GITHUB_TOKEN', 'ghp_example_token']]
    )(function* () {
      const token = yield* GITHUB_TOKEN;
      expect(Redacted.value(token)).to.equal('ghp_example_token');
    }));

    it('fails when github token is missing', run([])(function* () {
      const result = yield* Effect.either(GITHUB_TOKEN);
      expect(Either.isLeft(result)).to.be.true;
    }));
  });
});
