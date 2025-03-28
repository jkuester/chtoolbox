#!/usr/bin/env node
import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { EnvironmentService } from './services/environment.js';
export declare const initializeUrl: Effect.Effect<string, Error, EnvironmentService | Command.Command.Context<"chtx">>;
//# sourceMappingURL=index.d.ts.map