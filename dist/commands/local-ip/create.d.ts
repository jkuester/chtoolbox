import { Command } from '@effect/cli';
import { LocalIpService } from '../../services/local-ip.js';
export declare const create: Command.Command<"create", LocalIpService, Error, {
    readonly toPort: number;
    readonly fromPort: import("effect/Option").Option<number>;
}>;
//# sourceMappingURL=create.d.ts.map