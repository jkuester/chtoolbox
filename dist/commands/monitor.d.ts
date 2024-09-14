import { Command } from '@effect/cli';
import { CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbsInfoService } from '../services/couch/dbs-info';
export declare const monitor: Command.Command<"monitor", CouchNodeSystemService | CouchDbsInfoService, Error | import("@effect/platform/HttpBody").HttpBodyError, {}>;
//# sourceMappingURL=monitor.d.ts.map