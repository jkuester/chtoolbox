#!/usr/bin/env node
import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { EnvironmentService } from './services/environment';
export declare const initializeUrl: Effect.Effect<void, never, EnvironmentService | Command.Command.Context<"chtx">>;
//# sourceMappingURL=index.d.ts.map