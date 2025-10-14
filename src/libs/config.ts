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
  Option.map(COUCH_URL => ({ COUCH_URL })),
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
  Config.validate({
    message: 'Username not included',
    validation: ({ username }) => String.isNonEmpty(username)
  }),
  Config.validate({
    message: 'Password not included',
    validation: ({ password }) => String.isNonEmpty(password)
  }),
  Config.map(Redacted.make)
);

export const CHT_USERNAME = pipe(
  Config.string('CHT_USERNAME'),
  Config.withDescription('Admin username for the target CHT instance.'),
  Config.orElse(() => pipe(
    COUCH_URL,
    Config.map(Redacted.value),
    Config.map(({ username }) => username)
  ))
);

const CHT_PASSWORD = pipe(
  Config.redacted('CHT_PASSWORD'),
  Config.withDescription('Admin password for the target CHT instance.'),
  Config.orElse(() => pipe(
    COUCH_URL,
    Config.map(Redacted.value),
    Config.map(({ password }) => Redacted.make(password))
  ))
);

const CHT_URL = pipe(
  Config.url('CHT_URL'),
  Config.withDescription('URL for the target CHT instance.'),
  Config.validate({
    message: 'Username should not be included',
    validation: ({ username }) => String.isEmpty(username)
  }),
  Config.validate({
    message: 'Password should not be included',
    validation: ({ password }) => String.isEmpty(password)
  }),
  Config.orElse(() => pipe(
    COUCH_URL,
    Config.map(Redacted.value),
    Config.map(url => new URL('/', url)),
    Config.map(withoutCreds)
  ))
);

/**
 * @deprecated Including credentials in the URL increases the risk of inadvertently revealing them (e.g. in logs or
 * error messages). Use CHT_URL instead along with CHT_USERNAME and CHT_PASSWORD for authentication.
 */
export const CHT_URL_AUTHENTICATED = pipe(
  Config.all([CHT_URL, CHT_USERNAME, CHT_PASSWORD]),
  Config.map(Function.tupled(withCreds)),
);
