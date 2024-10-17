import * as Effect from 'effect/Effect';
import { CouchDbInfo, CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignInfo, CouchDesignInfoService } from './couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
import { Option } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage';
import { ResponseError } from '@effect/platform/HttpClientError';
interface DatabaseInfo extends CouchDbInfo {
    designs: CouchDesignInfo[];
}
export interface MonitoringData extends CouchNodeSystem {
    unix_time: number;
    databases: DatabaseInfo[];
    directory_size: Option.Option<number>;
}
declare const MonitorService_base: Effect.Service.Class<MonitorService, "chtoolbox/MonitorService", {
    readonly effect: Effect.Effect<{
        get: (directory: Option.Option<string>) => Effect.Effect<MonitoringData, Error | ResponseError | import("@effect/schema/ParseResult").ParseError | import("@effect/platform/Error").PlatformError, never>;
        getCsvHeader: (directory: Option.Option<string>) => string[];
        getAsCsv: (directory: Option.Option<string>) => Effect.Effect<string[], Error | ResponseError | import("@effect/schema/ParseResult").ParseError | import("@effect/platform/Error").PlatformError, never>;
    }, never, CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService | LocalDiskUsageService>;
    readonly accessors: true;
}>;
export declare class MonitorService extends MonitorService_base {
}
export {};
//# sourceMappingURL=monitor.d.ts.map