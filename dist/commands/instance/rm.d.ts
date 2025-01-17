import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance.js';
export declare const rm: Command.Command<"rm", import("@effect/platform/Terminal").Terminal | LocalInstanceService, Error | import("@effect/platform/Terminal").QuitException, {
    readonly names: [string, ...string[]];
    readonly yes: boolean;
}>;
//# sourceMappingURL=rm.d.ts.map