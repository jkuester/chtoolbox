import { Command } from '@effect/cli';
import { CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbsInfoService } from '../services/couch/dbs-info';
import { CouchDesignInfoService } from '../services/couch/design-info';
export declare const monitor: Command.Command<"monitor", CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService | Command.Command.Context<"chtx">, Error, {
    readonly interval: number;
}>;
//# sourceMappingURL=monitor.d.ts.map