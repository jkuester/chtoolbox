import * as Effect from 'effect/Effect';
import { CouchDbInfo } from '../libs/couch/dbs-info';
import { CouchDesignInfo } from '../libs/couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
import { Option } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage';
import { PlatformError } from '@effect/platform/Error';
import { ChtClientService } from './cht-client';
interface DatabaseInfo extends CouchDbInfo {
    designs: CouchDesignInfo[];
}
interface MonitoringData extends CouchNodeSystem {
    unix_time: number;
    databases: DatabaseInfo[];
    directory_size: Option.Option<number>;
}
declare const MonitorService_base: Effect.Service.Class<MonitorService, "chtoolbox/MonitorService", {
    readonly effect: Effect.Effect<{
        get: (directory: Option.Option<string>) => Effect.Effect<MonitoringData, Error | PlatformError>;
        getCsvHeader: (directory: Option.Option<string>) => string[];
        getAsCsv: (directory: Option.Option<string>) => Effect.Effect<string[], Error | PlatformError>;
    }, never, ChtClientService | CouchNodeSystemService | LocalDiskUsageService>;
    readonly accessors: true;
}>;
export declare class MonitorService extends MonitorService_base {
}
export {};
//# sourceMappingURL=monitor.d.ts.map