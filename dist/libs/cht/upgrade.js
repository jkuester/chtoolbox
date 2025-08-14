import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
import { ResponseError } from '@effect/platform/HttpClientError';
import { pipe, Schema } from 'effect';
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
const setBody = (version) => pipe({ build: { version, namespace: NAMESPACE, application: APPLICATION } }, body => UpgradeBody.pipe(HttpClientRequest.schemaBodyJson)(body));
const postUpgrade = (endpoint) => Effect.fn((version) => pipe(HttpClientRequest.post(endpoint), setBody(version), Effect.flatMap(ChtClientService.request), Effect.scoped));
export const upgradeCht = postUpgrade(ENDPOINT_UPGRADE);
export const stageChtUpgrade = postUpgrade(ENDPOINT_STAGE);
export const completeChtUpgrade = Effect.fn((version) => pipe(version, postUpgrade(ENDPOINT_COMPLETE), Effect.catchIf((err) => err instanceof ResponseError && err.response.status === 502, () => Effect.void), Effect.scoped));
