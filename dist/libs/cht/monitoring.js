import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
import { Schema } from 'effect';
const ENDPOINT = '/api/v2/monitoring';
export class ChtMonitoringData extends Schema.Class('ChtMonitoringData')({
    version: Schema.Struct({
        app: Schema.String,
        couchdb: Schema.String,
    }),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(ChtMonitoringData);
}
export const getChtMonitoringData = () => ChtClientService
    .request(HttpClientRequest.get(ENDPOINT))
    .pipe(Effect.flatMap(ChtMonitoringData.decodeResponse), Effect.scoped);
