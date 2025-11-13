import { Config, ConfigProvider, Effect, Function, Option, pipe, Redacted, String } from 'effect';
import envPaths from 'env-paths';
import { readJsonFile } from './file.ts';
import { withCreds, withoutCreds } from './url.js';

const CONFIG_FILE_NAME = 'chtoolbox.json';

const paths = envPaths('chtoolbox', { suffix: '' });

const fileConfigProviderEffect = Effect.suspend(() => pipe(
  readJsonFile(CONFIG_FILE_NAME, paths.config, {}),
  Effect.map(ConfigProvider.fromJson),
));

const getConfigProviderFromOpts = ({ url }: { url: Option.Option <string> }) => pipe(
  url,
  Option.map(url => new URL(url)),
  Option.map(url => ({
    COUCH_URL: url.toString(),
    CHT_URL: pipe(url, withoutCreds).toString(),
    CHT_USERNAME: url.username || undefined,
    CHT_PASSWORD: url.password || undefined,
  })),
  Option.getOrElse(() => ({})),
  ConfigProvider.fromJson
);

export const getChtxConfigProvider = Effect.fn((opts: { url: Option.Option <string> }) => pipe(
  fileConfigProviderEffect,
  Effect.map(fileConfigProvider => pipe(
    getConfigProviderFromOpts(opts),
    ConfigProvider.orElse(() => ConfigProvider.fromEnv()),
    ConfigProvider.orElse(() => fileConfigProvider)
  )),
));

export const GITHUB_TOKEN = Config
  .redacted('GITHUB_TOKEN')
  .pipe(
    Config.withDescription('GitHub api token with at least read-only access to public repositories.'),
  );

const COUCH_URL = pipe(
  Config.url('COUCH_URL'),
  Config.withDescription('Connection information for the CHT/CouchDB instance.'),
  Config.map(Redacted.make)
);

export const CHT_USERNAME = pipe(
  Config.string('CHT_USERNAME'),
  Config.withDescription('Admin username for the target CHT instance.'),
  Config.orElse(() => pipe(
    COUCH_URL,
    Config.map(Redacted.value),
    Config.map(({ username }) => username)
  )),
  Config.validate({
    message: 'CHT_USERNAME not provided',
    validation: (username) => String.isNonEmpty(username)
  }),
);

export const CHT_PASSWORD = pipe(
  Config.redacted('CHT_PASSWORD'),
  Config.withDescription('Admin password for the target CHT instance.'),
  Config.orElse(() => pipe(
    COUCH_URL,
    Config.map(Redacted.value),
    Config.map(({ password }) => Redacted.make(password))
  )),
  Config.validate({
    message: 'CHT_PASSWORD not provided',
    validation: (password) => pipe(Redacted.value(password), String.isNonEmpty)
  }),
);

export const CHT_URL = pipe(
  Config.url('CHT_URL'),
  Config.withDescription('URL for the target CHT instance.'),
  Config.orElse(() => pipe(
    COUCH_URL,
    Config.map(Redacted.value),
    Config.map(url => new URL('/', url)),
    Config.map(withoutCreds)
  )),
  Config.validate({
    message: 'Username/password should not be included in the CHT_URL',
    validation: ({ username, password }) => String.isEmpty(username) || String.isEmpty(password)
  }),
);

/**
 * @deprecated Including credentials in the URL increases the risk of inadvertently revealing them (e.g. in logs or
 * error messages). Use CHT_URL instead along with CHT_USERNAME and CHT_PASSWORD for authentication.
 */
export const CHT_URL_AUTHENTICATED = pipe(
  Config.all([CHT_URL, CHT_USERNAME, CHT_PASSWORD]),
  Config.map(Function.tupled(withCreds)),
);
