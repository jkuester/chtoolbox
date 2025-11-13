import { describe, it } from 'mocha';
import { Config, Effect, Either, Layer, Option, pipe, Redacted } from 'effect';
import { expect } from 'chai';
import * as ConfigLibs from '../../src/libs/config.ts';
import {
  DEFAULT_CHT_PASSWORD,
  DEFAULT_CHT_URL_AUTH,
  DEFAULT_CHT_USERNAME,
  DEFAULT_CHT_URL,
  genWithConfig,
  sandbox
} from '../utils/base.ts';
import esmock from 'esmock';
import { FileSystem } from '@effect/platform';

const run = genWithConfig(Layer.empty);

const readJsonFile = sandbox.stub();

const {
  getChtxConfigProvider,
  GITHUB_TOKEN,
  CHT_USERNAME,
  CHT_PASSWORD,
  CHT_URL,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  CHT_URL_AUTHENTICATED,
} = await esmock<typeof ConfigLibs>('../../src/libs/config.ts', {
  '../../src/libs/file.ts': { readJsonFile }
});

describe('Config libs', () => {
  const ENVAR_VALUE = `${DEFAULT_CHT_URL_AUTH}medic`;

  describe('getChtxConfigProvider', () => {
    // eslint-disable-next-line dot-notation
    const originalCouchUrl = process.env['COUCH_URL'];

    beforeEach(() => {
      // Make sure to clear any COUCH_URL value coming from the local environment
      // eslint-disable-next-line dot-notation
      delete process.env['COUCH_URL'];
    });

    after(() => {
      // eslint-disable-next-line dot-notation
      process.env['COUCH_URL'] = originalCouchUrl;
    });

    it('returns a config provider that loads from a JSON file', () => {
      readJsonFile.returns(Effect.succeed({ COUCH_URL: ENVAR_VALUE}));

      const configProvider = Effect.runSync(pipe(
        getChtxConfigProvider({ url: Option.none() }),
        Effect.provide(Layer.succeed(FileSystem.FileSystem, {} as unknown as FileSystem.FileSystem))
      ));

      const result = Effect.runSync(pipe(
        Config.string('COUCH_URL'),
        Effect.withConfigProvider(configProvider)
      ));

      expect(result).to.equal(ENVAR_VALUE);
    });

    it('returns a config provider that loads from the environment variables', () => {
      readJsonFile.returns(Effect.succeed({ COUCH_URL: 'invalid'}));
      // eslint-disable-next-line dot-notation
      process.env['COUCH_URL'] = ENVAR_VALUE;

      const configProvider = Effect.runSync(pipe(
        getChtxConfigProvider({ url: Option.none() }),
        Effect.provide(Layer.succeed(FileSystem.FileSystem, {} as unknown as FileSystem.FileSystem))
      ));

      const result = Effect.runSync(pipe(
        Config.string('COUCH_URL'),
        Effect.withConfigProvider(configProvider)
      ));

      expect(result).to.equal(ENVAR_VALUE);
    });

    it('returns a config provider that loads from the provided options', () => {
      readJsonFile.returns(Effect.succeed({
        COUCH_URL: 'invalid',
        CHT_USERNAME: 'invalid',
        CHT_PASSWORD: 'invalid'
      }));
      // eslint-disable-next-line dot-notation
      process.env['COUCH_URL'] = 'invalid';

      const configProvider = Effect.runSync(pipe(
        getChtxConfigProvider({ url: Option.some(ENVAR_VALUE) }),
        Effect.provide(Layer.succeed(FileSystem.FileSystem, {} as unknown as FileSystem.FileSystem))
      ));

      const COUCH_URL = Effect.runSync(pipe(
        Config.string('COUCH_URL'),
        Effect.withConfigProvider(configProvider)
      ));
      const CHT_USERNAME = Effect.runSync(pipe(
        Config.string('CHT_USERNAME'),
        Effect.withConfigProvider(configProvider)
      ));
      const CHT_PASSWORD = Effect.runSync(pipe(
        Config.string('CHT_PASSWORD'),
        Effect.withConfigProvider(configProvider)
      ));

      expect(COUCH_URL).to.equal(ENVAR_VALUE);
      expect(CHT_USERNAME).to.equal(DEFAULT_CHT_USERNAME);
      expect(CHT_PASSWORD).to.equal(DEFAULT_CHT_PASSWORD);
    });

    it('loads CHT_URL from the provided options even without credentials', () => {
      readJsonFile.returns(Effect.succeed({
        CHT_USERNAME: DEFAULT_CHT_USERNAME,
        CHT_PASSWORD: DEFAULT_CHT_PASSWORD
      }));

      const configProvider = Effect.runSync(pipe(
        getChtxConfigProvider({ url: Option.some(DEFAULT_CHT_URL) }),
        Effect.provide(Layer.succeed(FileSystem.FileSystem, {} as unknown as FileSystem.FileSystem))
      ));

      const CHT_URL = Effect.runSync(pipe(
        Config.string('CHT_URL'),
        Effect.withConfigProvider(configProvider)
      ));
      const CHT_USERNAME = Effect.runSync(pipe(
        Config.string('CHT_USERNAME'),
        Effect.withConfigProvider(configProvider)
      ));
      const CHT_PASSWORD = Effect.runSync(pipe(
        Config.string('CHT_PASSWORD'),
        Effect.withConfigProvider(configProvider)
      ));

      expect(CHT_URL).to.equal(DEFAULT_CHT_URL);
      expect(CHT_USERNAME).to.equal(DEFAULT_CHT_USERNAME);
      expect(CHT_PASSWORD).to.equal(DEFAULT_CHT_PASSWORD);
    });
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

  describe('CHT_USERNAME', () => {
    it('returns CHT_USERNAME from env', run(
      [['CHT_USERNAME', 'admin']]
    )(function* () {
      const username = yield* CHT_USERNAME;
      expect(username).to.equal('admin');
    }));

    it('falls back to COUCH_URL username', run(
      [['COUCH_URL', DEFAULT_CHT_URL_AUTH]]
    )(function* () {
      const username = yield* CHT_USERNAME;
      expect(username).to.equal(DEFAULT_CHT_USERNAME);
    }));

    it('fails if neither CHT_USERNAME nor COUCH_URL is set', run([])(function* () {
      const result = yield* Effect.either(CHT_USERNAME);
      expect(Either.isLeft(result)).to.be.true;
    }));

    it('fails if an empty value is set', run(
      [['CHT_USERNAME', '']]
    )(function* () {
      const result = yield* Effect.either(CHT_USERNAME);

      if (Either.isRight(result)) {
        expect.fail('Expected error');
      }

      expect(result.left.message).to.equal('CHT_USERNAME not provided');
    }));
  });

  describe('CHT_PASSWORD', () => {
    it('returns CHT_PASSWORD from env', run(
      [['CHT_PASSWORD', 'secret']]
    )(function* () {
      const password = yield* CHT_PASSWORD;
      expect(Redacted.value(password)).to.equal('secret');
    }));

    it('falls back to COUCH_URL password', run(
      [['COUCH_URL', DEFAULT_CHT_URL_AUTH]]
    )(function* () {
      const password = yield* CHT_PASSWORD;
      expect(Redacted.value(password)).to.equal(DEFAULT_CHT_PASSWORD);
    }));

    it('fails if neither CHT_PASSWORD nor COUCH_URL is set', run([])(function* () {
      const result = yield* Effect.either(CHT_PASSWORD);
      expect(Either.isLeft(result)).to.be.true;
    }));

    it('fails if an empty value is set', run(
      [['CHT_PASSWORD', '']]
    )(function* () {
      const result = yield* Effect.either(CHT_PASSWORD);

      if (Either.isRight(result)) {
        expect.fail('Expected error');
      }

      expect(result.left.message).to.equal('CHT_PASSWORD not provided');
    }));
  });

  describe('CHT_URL', () => {
    it('returns CHT_URL from env', run(
      [['CHT_URL', 'http://localhost:5984']]
    )(function* () {
      const url = yield* CHT_URL;
      expect(url.toString()).to.equal('http://localhost:5984/');
    }));

    it('falls back to COUCH_URL without credentials', run(
      [['COUCH_URL', 'http://user:pass@localhost:5984/medic']]
    )(function* () {
      const url = yield* CHT_URL;
      expect(url.toString()).to.equal('http://localhost:5984/');
    }));

    it('fails if neither CHT_URL nor COUCH_URL is set', run([])(function* () {
      const result = yield* Effect.either(CHT_URL);
      expect(Either.isLeft(result)).to.be.true;
    }));

    it('fails if a username/password are provided', run(
      [['CHT_URL', 'http://user:pass@localhost:5984/medic']]
    )(function* () {
      const result = yield* Effect.either(CHT_URL);

      if (Either.isRight(result)) {
        expect.fail('Expected error');
      }

      expect(result.left.message).to.equal('Username/password should not be included in the CHT_URL');
    }));
  });

  describe('CHT_URL_AUTHENTICATED', () => {
    it('returns authenticated URL from CHT_URL, CHT_USERNAME, CHT_PASSWORD', run(
      [
        ['CHT_URL', 'http://localhost:5984'],
        ['CHT_USERNAME', 'admin'],
        ['CHT_PASSWORD', 'secret']
      ]
    )(function* () {
      const url = yield* CHT_URL_AUTHENTICATED;
      expect(Redacted.value(url).toString()).to.equal('http://admin:secret@localhost:5984/');
    }));

    it('returns authenticated URL from COUCH_URL fallback', run(
      [['COUCH_URL', 'http://user:pass@localhost:5984']]
    )(function* () {
      const url = yield* CHT_URL_AUTHENTICATED;
      expect(Redacted.value(url).toString()).to.equal('http://user:pass@localhost:5984/');
    }));

    it('fails if neither CHT_URL/CHT_USERNAME/CHT_PASSWORD nor COUCH_URL is set', run([])(function* () {
      const result = yield* Effect.either(CHT_URL_AUTHENTICATED);
      expect(Either.isLeft(result)).to.be.true;
    }));
  });
});
