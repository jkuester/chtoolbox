import * as Schema from '@effect/schema/Schema';
import { HttpClientRequest } from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { ChtClientService } from '../cht-client';

const getDesignPath = (designName?: string) => designName ? `/${designName}` : '';

const getCompactRequest = (dbName: string, designName?: string) => Schema
  .Struct({})
  .pipe(
    HttpClientRequest.schemaBodyJson,
    build => build(HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}),
    Effect.mapError(x => x as unknown as Error),
  );

const compact = (context: Context.Context<ChtClientService>) => (
  dbName: string,
  designName?: string
) => getCompactRequest(dbName, designName)
  .pipe(
    Effect.flatMap(request => ChtClientService.request(request)),
    Effect.andThen(Effect.void),
    Effect.scoped,
    Effect.provide(context),
  );

const serviceContext = ChtClientService.pipe(Effect.map(couch => Context.make(ChtClientService, couch)));

export class CouchCompactService extends Effect.Service<CouchCompactService>()('chtoolbox/CouchCompactService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    compactDb: compact(context),
    compactDesign: compact(context),
  }))),
  accessors: true,
}) {
}
