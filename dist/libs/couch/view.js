import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from "../../services/cht-client.js";
import { pipe } from 'effect';
export const warmView = Effect.fn((dbName, designName, viewName) => pipe(HttpClientRequest.get(`/${dbName}/_design/${designName}/_view/${viewName}`), HttpClientRequest.setUrlParam('limit', '0'), ChtClientService.request, Effect.andThen(Effect.void), Effect.scoped));
