import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbInfo, CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignInfo, CouchDesignInfoService } from './couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
import { Option } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage';
import { PlatformError } from '@effect/platform/Error';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { CouchResponseEffect } from './couch/couch';
interface DatabaseInfo extends CouchDbInfo {
    designs: CouchDesignInfo[];
}
export interface MonitoringData extends CouchNodeSystem {
    unix_time: number;
    databases: DatabaseInfo[];
    directory_size: Option.Option<number>;
}
interface MonitoringDataEffect<A extends MonitoringData | string[]> extends CouchResponseEffect<A, PlatformError, CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService | LocalDiskUsageService | CommandExecutor> {
}
export interface MonitorService {
    readonly get: (directory: Option.Option<string>) => MonitoringDataEffect<MonitoringData>;
    readonly getCsvHeader: (directory: Option.Option<string>) => string[];
    readonly getAsCsv: (directory: Option.Option<string>) => MonitoringDataEffect<string[]>;
}
export declare const MonitorService: Context.Tag<MonitorService, MonitorService>;
export declare const MonitorServiceLive: Layer.Layer<MonitorService, never, never>;
export {};
//# sourceMappingURL=monitor.d.ts.map