import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance.js';
export declare const create: Command.Command<"create", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
    readonly version: string;
}>;
//# sourceMappingURL=create.d.ts.map