import { FileSystem } from '@effect/platform';
import { Command } from '@effect/cli';
import { Option } from 'effect';
import { LocalInstanceService } from '../../services/local-instance.ts';
export declare const create: Command.Command<"create", FileSystem.FileSystem | LocalInstanceService, Error | import("@effect/platform/Error").PlatformError, {
    readonly names: [string, ...string[]];
    readonly version: string;
    readonly directory: Option.Option<string>;
}>;
//# sourceMappingURL=create.d.ts.map