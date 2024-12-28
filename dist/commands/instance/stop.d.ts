import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance';
export declare const stop: Command.Command<"stop", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
}>;
//# sourceMappingURL=stop.d.ts.map