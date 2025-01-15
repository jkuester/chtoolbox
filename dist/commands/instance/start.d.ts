import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance.js';
export declare const start: Command.Command<"start", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
}>;
//# sourceMappingURL=start.d.ts.map