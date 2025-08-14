import { Function, pipe, Schema, Tuple } from 'effect';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
import { buildPostRequest } from '../http-client.js';
const getDesignPath = (designName) => designName ? `/${designName}` : '';
const buildRequest = (dbName, designName) => pipe(getDesignPath(designName), designPath => Tuple.make(`/${dbName}/_compact${designPath}`), Tuple.appendElement(Schema.Struct({})), Function.tupled(buildPostRequest));
const getCompactRequest = Effect.fn((dbName, designName) => pipe({}, // Empty body
buildRequest(dbName, designName)));
const compact = Effect.fn((dbName, designName) => getCompactRequest(dbName, designName), Effect.flatMap(request => ChtClientService.request(request)), Effect.scoped);
export const compactDb = Effect.fn((dbName) => compact(dbName));
export const compactDesign = Effect.fn((dbName, designName) => compact(dbName, designName));
