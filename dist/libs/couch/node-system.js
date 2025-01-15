import { Schema } from 'effect';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';
const ENDPOINT = '/_node/_local/_system';
export class CouchNodeSystem extends Schema.Class('CouchNodeSystem')({
    memory: Schema.Struct({
        processes_used: Schema.Number,
        binary: Schema.Number,
    }),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(CouchNodeSystem);
}
export const getCouchNodeSystem = () => ChtClientService
    .request(HttpClientRequest.get(ENDPOINT))
    .pipe(Effect.flatMap(CouchNodeSystem.decodeResponse), Effect.scoped);
//# sourceMappingURL=node-system.js.map