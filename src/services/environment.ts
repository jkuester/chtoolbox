import { Config, Effect, Option, Redacted, Ref, String, Array, Predicate } from 'effect';

const COUCH_URL_PATTERN = /^(https?:\/\/([^:]+):[^/]+).*$/;

export interface Environment {
  readonly url: Redacted.Redacted;
  readonly user: string;
}

const parseCouchUrl = (url: Redacted.Redacted): Effect.Effect<Environment, Error> => url.pipe(
  Redacted.value,
  String.match(COUCH_URL_PATTERN),
  Option.map(([, url, user]) => [url, user]),
  Option.filter((data): data is [string, string] => Array.every(data, Predicate.isNotNullable)),
  Option.map(([url, user]) => ({
    url: Redacted.make(`${url}/`),
    user
  })),
  Option.map(Effect.succeed),
  Option.getOrElse(() => Effect.fail(Error('Could not parse URL.'))),
);

const COUCH_URL = Config
  .redacted('COUCH_URL')
  .pipe(
    Config.withDescription('The URL of the CouchDB server.'),
    Config.option,
  );

const createEnvironmentService = Ref
  .make({
    url: Redacted.make(String.empty) as Redacted.Redacted,
    user: String.empty as string,
  })
  .pipe(
    Effect.map(env => ({
      get: (): Effect.Effect<Environment> => Ref.get(env),
      setUrl: (url: Redacted.Redacted): Effect.Effect<Environment, Error> => parseCouchUrl(url)
        .pipe(Effect.flatMap(newEnv => Ref.setAndGet(env, newEnv))),
    })),
    Effect.tap((envService) => COUCH_URL.pipe(
      Config.map(Option.map(envService.setUrl)),
      Config.map(Option.map(Effect.asVoid)),
      Effect.flatMap(Option.getOrElse(() => Effect.void)),
    )),
  );

export class EnvironmentService extends Effect.Service<EnvironmentService>()(
  'chtoolbox/EnvironmentService',
  { effect: createEnvironmentService, accessors: true, }
) {
}
