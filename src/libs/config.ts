import { Config, ConfigProvider, Effect, pipe } from 'effect';
import envPaths from 'env-paths';
import { readJsonFile } from './file.ts';

const CONFIG_FILE_NAME = 'chtoolbox.json';

const paths = envPaths('chtoolbox', { suffix: '' });

const fileConfigProviderEffect = Effect.suspend(() => pipe(
  readJsonFile(CONFIG_FILE_NAME, paths.config, {}),
  Effect.map(ConfigProvider.fromJson),
));

export const configProviderEffect = Effect.suspend(() => pipe(
  fileConfigProviderEffect,
  Effect.map(fileConfigProvider => pipe(
    ConfigProvider.fromEnv(),
    ConfigProvider.orElse(() => fileConfigProvider)
  )),
));

export const GITHUB_TOKEN = Config
  .redacted('GITHUB_TOKEN')
  .pipe(
    Config.withDescription('GitHub api token with at least read-only access to public repositories.'),
  );
