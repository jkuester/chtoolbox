import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { ResponseError } from '@effect/platform/HttpClientError';
import { Schema } from 'effect';
import { HttpClientResponse } from '@effect/platform/HttpClientResponse';

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

export const upgradeCht = (
  version: string
): Effect.Effect<HttpClientResponse, Error, ChtClientService> => postUpgrade(ENDPOINT_UPGRADE, version);

export const stageChtUpgrade = (
  version: string
): Effect.Effect<HttpClientResponse, Error, ChtClientService> => postUpgrade(ENDPOINT_STAGE, version);

export const completeChtUpgrade = (
  version: string
): Effect.Effect<void, Error, ChtClientService> => postUpgrade(ENDPOINT_COMPLETE, version)
  .pipe(
    Effect.catchIf(
      (err) => err instanceof ResponseError && err.response.status === 502,
      () => Effect.void, // The api server is restarting, so we can ignore this error
    ),
    Effect.scoped,
  );
