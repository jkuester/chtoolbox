import * as Schema from '@effect/schema/Schema';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { Effect } from 'effect';

const WITH_MEDIC_PATTERN = /^(.+)\/medic$/g;
const { COUCH_URL } = process.env;

class Environment extends Schema.Class<Environment>('Environment')({
  couchUrl: Schema.String,
}) {
}

interface EnvironmentService {
  readonly get: () => Environment;
}

export const EnvironmentService = Context.GenericTag<EnvironmentService>('chtoolbox/EnvironmentService');

const trimTrailingMedic = (url: string) => url.replace(WITH_MEDIC_PATTERN, '$1');

const getCouchUrl = Effect
  .fromNullable(COUCH_URL)
  .pipe(
    Effect.catchTag('NoSuchElementException', () => Effect.fail(new Error('COUCH_URL not set'))),
    Effect.map(trimTrailingMedic)
  );

const createEnvironmentService = getCouchUrl.pipe(
  Effect.map(couchUrl => new Environment({
    couchUrl
  })),
  Effect.map(env => EnvironmentService.of({ get: () => env }))
);

export const EnvironmentServiceImpl = Layer.effect(EnvironmentService, createEnvironmentService);
