import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Config, Effect, Option, Ref } from 'effect';

const WITH_MEDIC_PATTERN = /^(.+)\/medic$/g;

// TODO Should be a ConfigurationProvider?
export interface EnvironmentService {
  readonly url: Ref.Ref<string>;
}

export const EnvironmentService = Context.GenericTag<EnvironmentService>('chtoolbox/EnvironmentService');

const trimTrailingMedic = (url: string) => url.replace(WITH_MEDIC_PATTERN, '$1');

const COUCH_URL = Config
  .string('COUCH_URL')
  .pipe(
    Config.option,
    Config.map(Option.map(trimTrailingMedic)),
    Config.map(Option.getOrElse(() => ''))
  );

// TODO Should consider using a Ref of a Config to do magic config stuff
const createEnvironmentService = COUCH_URL.pipe(
  Effect.flatMap(Ref.make),
  Effect.map(url => EnvironmentService.of({
    url,
  }))
);

export const EnvironmentServiceLive = Layer.effect(EnvironmentService, createEnvironmentService);
