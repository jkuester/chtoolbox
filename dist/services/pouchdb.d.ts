import * as Effect from 'effect/Effect';
import { EnvironmentService } from './environment';
export declare const assertPouchResponse: (value: PouchDB.Core.Response | PouchDB.Core.Error) => PouchDB.Core.Response;
declare const PouchDBService_base: Effect.Service.Class<PouchDBService, "chtoolbox/PouchDBService", {
    readonly effect: Effect.Effect<{
        get: (dbName: string) => Effect.Effect<PouchDB.Database<{}>, never, never>;
    }, never, EnvironmentService>;
    readonly accessors: true;
}>;
export declare class PouchDBService extends PouchDBService_base {
}
export {};
//# sourceMappingURL=pouchdb.d.ts.map