import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { LocalInstanceService } from '../../services/local-instance.js';
export declare const printInstanceInfo: (names: string[]) => (ports: `${number}`[]) => Effect.Effect<void>;
export declare const create: Command.Command<"create", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
    readonly version: string;
}>;
//# sourceMappingURL=create.d.ts.map