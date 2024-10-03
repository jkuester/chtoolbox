import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Config, Effect, Option, Redacted, Ref, String } from 'effect';

const COUCH_URL_PATTERN = /^(https?:\/\/([^:]+):[^/]+).*$/;

export interface Environment {
  readonly url: Redacted.Redacted;
  readonly user: string;
}

export interface EnvironmentService {
  readonly get: () => Effect.Effect<Environment>;
  readonly setUrl: (url: Redacted.Redacted) => Effect.Effect<Environment>;
}

export const EnvironmentService = Context.GenericTag<EnvironmentService>('chtoolbox/EnvironmentService');

const parseCouchUrl = (url: Redacted.Redacted) => url.pipe(
  Redacted.value,
  String.match(COUCH_URL_PATTERN),
  Option.map(([, url, user]) => ({
    url: Redacted.make(`${url}/`),
    user
  })),
  Option.getOrThrowWith(() => Error('Could not parse URL.')),
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
    Effect.map(env => EnvironmentService.of({
      get: () => Ref.get(env),
      setUrl: url => Ref.setAndGet(env, parseCouchUrl(url)),
    })),
    Effect.tap((envService) => COUCH_URL.pipe(
      Config.map(Option.map(envService.setUrl)),
      Config.map(Option.map(Effect.asVoid)),
      Effect.flatMap(Option.getOrElse(() => Effect.void)),
    )),
  );

export const EnvironmentServiceLive = Layer.effect(EnvironmentService, createEnvironmentService);
