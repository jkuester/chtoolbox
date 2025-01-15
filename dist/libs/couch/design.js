import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.js';
import { Option, Schema } from 'effect';
class CouchDesign extends Schema.Class('CouchDesign')({
    _id: Schema.String,
    views: Schema.UndefinedOr(Schema.Object),
}) {
    static decodeResponse = HttpClientResponse.schemaBodyJson(CouchDesign);
}
export const getViewNames = (dbName, designName) => ChtClientService
    .request(HttpClientRequest.get(`/${dbName}/_design/${designName}`))
    .pipe(Effect.flatMap(CouchDesign.decodeResponse), Effect.scoped, Effect.map(design => design.views), Effect.map(Option.fromNullable), Effect.map(Option.map(Object.keys)), Effect.map(Option.getOrElse(() => [])));
//# sourceMappingURL=design.js.map