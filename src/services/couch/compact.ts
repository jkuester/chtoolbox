import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchResponseEffect, CouchService } from './couch';

export interface CouchCompactService {
  readonly compactDb: (dbName: string) => CouchResponseEffect<void>
  readonly compactDesign: (dbName: string, viewName: string) => CouchResponseEffect<void>
}

export const CouchCompactService = Context.GenericTag<CouchCompactService>('chtoolbox/CouchCompactService');

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const getCompactRequest = (dbName: string, designName?: string) => Schema
  .Struct({})
  .pipe(
    HttpClientRequest.schemaBody,
    build => build(HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}),
  );

const compact = (dbName: string, designName?: string) => Effect
  .all([CouchService, getCompactRequest(dbName, designName)])
  .pipe(
    Effect.flatMap(([couch, request]) => couch.request(request)),
    Effect.andThen(Effect.void),
    Effect.mapError(x => x as Error),
    Effect.scoped
  );

export const CouchCompactServiceLive = Layer.succeed(CouchCompactService, CouchCompactService.of({
  compactDb: compact,
  compactDesign: compact,
}));
