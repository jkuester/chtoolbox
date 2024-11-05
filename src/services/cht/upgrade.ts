import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { ChtClientService } from '../cht-client';
import { ResponseError } from '@effect/platform/HttpClientError';
import { Schema } from 'effect';

const ENDPOINT_UPGRADE = '/api/v1/upgrade';
const ENDPOINT_STAGE = `${ENDPOINT_UPGRADE}/stage`;
const ENDPOINT_COMPLETE = `${ENDPOINT_UPGRADE}/complete`;

const UpgradeBody = Schema.Struct({
  build: Schema.Struct({
    namespace: Schema.Literal('medic'),
    application: Schema.Literal('medic'),
    version: Schema.String,
  })
});
const getPostRequest = (endpoint: string, version: string) => UpgradeBody.pipe(
  HttpClientRequest.schemaBodyJson,
  build => build(
    HttpClientRequest.post(endpoint),
    { build: { version, namespace: 'medic', application: 'medic' } }
  ),
  Effect.mapError(x => x as unknown as Error),
);

const postUpgrade = (endpoint: string, version: string) => getPostRequest(endpoint, version)
  .pipe(
    Effect.flatMap(ChtClientService.request),
    Effect.scoped,
  );

const serviceContext = ChtClientService.pipe(Effect.map(cht => Context.make(ChtClientService, cht)));

export class ChtUpgradeService extends Effect.Service<ChtUpgradeService>()('chtoolbox/ChtUpgradeService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    upgrade: (version: string) => postUpgrade(ENDPOINT_UPGRADE, version)
      .pipe(Effect.provide(context)),
    stage: (version: string) => postUpgrade(ENDPOINT_STAGE, version)
      .pipe(Effect.provide(context)),
    complete: (version: string) => postUpgrade(ENDPOINT_COMPLETE, version)
      .pipe(
        Effect.catchIf(
          (err) => err instanceof ResponseError && err.response.status === 502,
          () => Effect.void, // The api server is restarting, so we can ignore this error
        ),
        Effect.scoped,
        Effect.provide(context)
      ),
  }))),
  accessors: true,
}) {
}
