import * as Effect from 'effect/Effect';
import { CouchDbInfo, CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignInfo, CouchDesignInfoService } from './couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
import { Option } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage';
import { PlatformError } from '@effect/platform/Error';
interface DatabaseInfo extends CouchDbInfo {
    designs: CouchDesignInfo[];
}
interface MonitoringData extends CouchNodeSystem {
    unix_time: number;
    databases: DatabaseInfo[];
    couchdb_directory_size: Option.Option<number>;
    nouveau_directory_size: Option.Option<number>;
}
declare const MonitorService_base: Effect.Service.Class<MonitorService, "chtoolbox/MonitorService", {
    readonly effect: Effect.Effect<{
        get: (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => Effect.Effect<MonitoringData, Error | PlatformError>;
        getCsvHeader: (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => string[];
        getAsCsv: (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => Effect.Effect<string[], Error | PlatformError>;
    }, never, CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService | LocalDiskUsageService>;
    readonly accessors: true;
}>;
export declare class MonitorService extends MonitorService_base {
}
export {};
//# sourceMappingURL=monitor.d.ts.map