import { Config } from 'effect';

export const GITHUB_TOKEN = Config
  .redacted('GITHUB_TOKEN')
  .pipe(
    Config.withDescription('GitHub api token with at least read-only access to public repositories.'),
  );
