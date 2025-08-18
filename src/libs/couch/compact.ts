import { Function, pipe, Schema, Tuple } from 'effect';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { buildPostRequest } from '../http-client.js';

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const buildRequest = (dbName: string, designName?: string) => pipe(
  getDesignPath(designName),
  designPath => Tuple.make(`/${dbName}/_compact${designPath}`),
  Tuple.appendElement(Schema.Struct({})),
  Function.tupled(buildPostRequest)
);

const getCompactRequest = Effect.fn((dbName: string, designName?: string) => pipe(
  {}, // Empty body
  buildRequest(dbName, designName),
));

const compact = Effect.fn((dbName: string, designName?: string) => pipe(
  Effect.logDebug(`Compacting ${dbName}/${designName ?? ''}`),
  Effect.andThen(getCompactRequest(dbName, designName)),
  Effect.flatMap(request => ChtClientService.request(request)),
  Effect.scoped,
));

export const compactDb = Effect.fn((dbName: string) => compact(dbName));
export const compactDesign = Effect.fn((dbName: string, designName: string) => compact(dbName, designName));
