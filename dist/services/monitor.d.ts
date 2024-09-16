import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbInfo, CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignInfo, CouchDesignInfoService } from './couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
interface DatabaseInfo extends CouchDbInfo {
    designs: CouchDesignInfo[];
}
export interface MonitoringData extends CouchNodeSystem {
    unix_time: number;
    databases: DatabaseInfo[];
}
export interface MonitorService {
    readonly get: () => Effect.Effect<MonitoringData, Error, CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService>;
    readonly getCsvHeader: () => string[];
    readonly getAsCsv: () => Effect.Effect<string[], Error, CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService>;
}
export declare const MonitorService: Context.Tag<MonitorService, MonitorService>;
export declare const MonitorServiceLive: Layer.Layer<MonitorService, never, never>;
export {};
//# sourceMappingURL=monitor.d.ts.map