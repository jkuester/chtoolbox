import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance.ts';
export declare const rm: Command.Command<"rm", LocalInstanceService | import("@effect/platform/Terminal").Terminal, Error | import("@effect/platform/Terminal").QuitException, {
    readonly names: [string, ...string[]];
    readonly yes: boolean;
}>;
//# sourceMappingURL=rm.d.ts.map