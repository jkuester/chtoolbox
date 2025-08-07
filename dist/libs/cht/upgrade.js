import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
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
const getPostRequest = (endpoint, version) => UpgradeBody.pipe(HttpClientRequest.schemaBodyJson, build => build(HttpClientRequest.post(endpoint), { build: { version, namespace: 'medic', application: 'medic' } }), Effect.mapError(x => x));
const postUpgrade = (endpoint, version) => getPostRequest(endpoint, version)
    .pipe(Effect.flatMap(ChtClientService.request), Effect.scoped);
export const upgradeCht = (version) => postUpgrade(ENDPOINT_UPGRADE, version);
export const stageChtUpgrade = (version) => postUpgrade(ENDPOINT_STAGE, version);
export const completeChtUpgrade = (version) => postUpgrade(ENDPOINT_COMPLETE, version)
    .pipe(Effect.catchIf((err) => err instanceof ResponseError && err.response.status === 502, () => Effect.void), Effect.scoped);
//# sourceMappingURL=upgrade.js.map