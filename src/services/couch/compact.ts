import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchService } from './couch';

export interface CouchCompactService {
  readonly compactDb: (dbName: string) => Effect.Effect<void, Error>
  readonly compactDesign: (dbName: string, viewName: string) => Effect.Effect<void, Error>
}

export const CouchCompactService = Context.GenericTag<CouchCompactService>('chtoolbox/CouchCompactService');

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const getCompactRequest = (dbName: string, designName?: string) => Schema
  .Struct({})
  .pipe(
    HttpClientRequest.schemaBody,
    build => build(HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}),
    Effect.mapError(x => x as unknown as Error),
  );

const compact = (context: Context.Context<CouchService>) => (dbName: string, designName?: string) => Effect
  .all([CouchService, getCompactRequest(dbName, designName)])
  .pipe(
    Effect.flatMap(([couch, request]) => couch.request(request)),
    Effect.andThen(Effect.void),
    Effect.scoped,
    Effect.provide(context),
  );

const ServiceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export const CouchCompactServiceLive = Layer.effect(CouchCompactService, ServiceContext.pipe(Effect.map(
  context => CouchCompactService.of({
    compactDb: compact(context),
    compactDesign: compact(context),
  })
)));
