import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { LocalChtInstance, LocalInstanceService } from '../../services/local-instance.js';
export declare const printInstanceTable: (instances: LocalChtInstance[]) => Effect.Effect<void, never, never>;
export declare const ls: Command.Command<"ls", LocalInstanceService, Error, {
    readonly names: string[];
}>;
//# sourceMappingURL=ls.d.ts.map