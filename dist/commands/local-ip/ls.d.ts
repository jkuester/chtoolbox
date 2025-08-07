import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { LocalIpService } from '../../services/local-ip.js';
export declare const printLocalIpInstances: (ports: {
    from: number;
    to: number;
}[]) => Effect.Effect<void, never, never>;
export declare const ls: Command.Command<"ls", LocalIpService, Error, {}>;
//# sourceMappingURL=ls.d.ts.map