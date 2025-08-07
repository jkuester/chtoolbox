import { Command } from '@effect/cli';
import { Option } from 'effect';
import { LocalInstanceService } from '../../services/local-instance.ts';
export declare const start: Command.Command<"start", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
    readonly directory: Option.Option<string>;
}>;
//# sourceMappingURL=start.d.ts.map