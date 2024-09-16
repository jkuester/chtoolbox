import { Command } from '@effect/cli';
import { CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbsInfoService } from '../services/couch/dbs-info';
export declare const monitor: Command.Command<"monitor", CouchNodeSystemService | CouchDbsInfoService | Command.Command.Context<"chtx">, Error, {
    readonly interval: number;
}>;
//# sourceMappingURL=monitor.d.ts.map