import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Config, Effect, Option, pipe, Ref } from 'effect';

const WITH_MEDIC_PATTERN = /^(.+)\/medic$/g;

export interface EnvironmentService {
  readonly url: Ref.Ref<Config.Config<string>>;
}

export const EnvironmentService = Context.GenericTag<EnvironmentService>('chtoolbox/EnvironmentService');

const trimTrailingMedic = (url: string) => url.replace(WITH_MEDIC_PATTERN, '$1');

const COUCH_URL = Config
  .string('COUCH_URL')
  .pipe(Config.map(trimTrailingMedic));

const createEnvironmentService = pipe(
  COUCH_URL,
  Ref.make,
  Effect.map(url => EnvironmentService.of({
    url,
  }))
);

export const EnvironmentServiceLive = Layer.effect(EnvironmentService, createEnvironmentService);
