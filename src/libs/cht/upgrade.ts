import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { ResponseError } from '@effect/platform/HttpClientError';
import { pipe, Schema } from 'effect';
import { buildPostRequest } from '../http-client.js';

const ENDPOINT_UPGRADE = '/api/v1/upgrade';
const ENDPOINT_STAGE = `${ENDPOINT_UPGRADE}/stage`;
const ENDPOINT_COMPLETE = `${ENDPOINT_UPGRADE}/complete`;
const NAMESPACE = 'medic';
const APPLICATION = 'medic';

const UpgradeBody = Schema.Struct({
  build: Schema.Struct({
    namespace: Schema.Literal(NAMESPACE),
    application: Schema.Literal(APPLICATION),
    version: Schema.String,
  })
});

const postUpgrade = (endpoint: string) => Effect.fn((version: string) => pipe(
  { build: { version, namespace: NAMESPACE, application: APPLICATION } },
  buildPostRequest(endpoint, UpgradeBody),
  Effect.flatMap(ChtClientService.request),
  Effect.scoped
));

export const upgradeCht = postUpgrade(ENDPOINT_UPGRADE);
export const stageChtUpgrade = postUpgrade(ENDPOINT_STAGE);
export const completeChtUpgrade = Effect.fn((version: string) => pipe(
  version,
  postUpgrade(ENDPOINT_COMPLETE),
  Effect.catchIf(
    (err) => err instanceof ResponseError && err.response.status === 502,
    () => Effect.void, // The api server is restarting, so we can ignore this error
  ),
  Effect.scoped,
));
