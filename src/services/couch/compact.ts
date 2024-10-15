import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { CouchService } from './couch';

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const getCompactRequest = (dbName: string, designName?: string) => Schema
  .Struct({})
  .pipe(
    HttpClientRequest.schemaBodyJson,
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

const serviceContext = CouchService.pipe(Effect.map(couch => Context.make(CouchService, couch)));

export class CouchCompactService extends Effect.Service<CouchCompactService>()('chtoolbox/CouchCompactService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    compactDb: compact(context),
    compactDesign: compact(context),
  }))),
  accessors: true,
}) {
}
