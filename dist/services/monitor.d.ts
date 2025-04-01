import * as Effect from 'effect/Effect';
import { CouchDbInfo } from '../libs/couch/dbs-info.js';
import { CouchDesignInfo } from '../libs/couch/design-info.js';
import { CouchNodeSystem } from '../libs/couch/node-system.js';
import { Option } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage.js';
import { PlatformError } from '@effect/platform/Error';
import { ChtClientService } from './cht-client.js';
import { NouveauInfo } from '../libs/couch/nouveau-info.js';
interface DatabaseInfo extends CouchDbInfo {
    designs: CouchDesignInfo[];
}
interface MonitoringData extends CouchNodeSystem {
    unix_time: number;
    databases: DatabaseInfo[];
    nouveau: NouveauInfo[];
    couchdb_directory_size: Option.Option<number>;
    nouveau_directory_size: Option.Option<number>;
}
declare const MonitorService_base: Effect.Service.Class<MonitorService, "chtoolbox/MonitorService", {
    readonly effect: Effect.Effect<{
        get: (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => Effect.Effect<MonitoringData, Error | PlatformError>;
        getCsvHeader: (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => string[];
        getAsCsv: (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => Effect.Effect<(string | number)[], Error | PlatformError>;
    }, never, ChtClientService | LocalDiskUsageService>;
    readonly accessors: true;
}>;
export declare class MonitorService extends MonitorService_base {
}
export {};
//# sourceMappingURL=monitor.d.ts.map