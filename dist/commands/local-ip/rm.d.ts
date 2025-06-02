import { Command } from '@effect/cli';
import { LocalIpService } from '../../services/local-ip.js';
export declare const rm: Command.Command<"rm", LocalIpService, Error, {
    readonly toPorts: [number, ...number[]];
}>;
//# sourceMappingURL=rm.d.ts.map