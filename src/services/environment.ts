import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Config, Effect, pipe, Redacted, Ref } from 'effect';

const WITH_MEDIC_PATTERN = /^(.+)\/medic$/g;

export interface EnvironmentService {
  readonly url: Ref.Ref<Config.Config<Redacted.Redacted>>;
}

export const EnvironmentService = Context.GenericTag<EnvironmentService>('chtoolbox/EnvironmentService');

const trimTrailingMedic = (url: Redacted.Redacted) => url.pipe(
  Redacted.value,
  url => url.replace(WITH_MEDIC_PATTERN, '$1'),
  Redacted.make
);

const COUCH_URL = Config
  .redacted('COUCH_URL')
  .pipe(
    Config.map(trimTrailingMedic),
    Config.withDescription('The URL of the CouchDB server.')
  );

const createEnvironmentService = pipe(
  COUCH_URL,
  Ref.make,
  Effect.map(url => EnvironmentService.of({
    url,
  }))
);

export const EnvironmentServiceLive = Layer.effect(EnvironmentService, createEnvironmentService);
