import { Schema } from 'effect';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
const getDesignPath = (designName) => designName ? `/${designName}` : '';
const getCompactRequest = Effect.fn((dbName, designName) => Schema
    .Struct({})
    .pipe(HttpClientRequest.schemaBodyJson, build => build(HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}), Effect.mapError(x => x)));
const compact = Effect.fn((dbName, designName) => getCompactRequest(dbName, designName), Effect.flatMap(request => ChtClientService.request(request)), Effect.andThen(Effect.void), Effect.scoped);
export const compactDb = Effect.fn((dbName) => compact(dbName));
export const compactDesign = Effect.fn((dbName, designName) => compact(dbName, designName));
