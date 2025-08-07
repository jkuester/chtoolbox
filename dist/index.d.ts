#!/usr/bin/env node
import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { EnvironmentService } from './services/environment.ts';
export declare const initializeUrl: Effect.Effect<string, Error, Command.Command.Context<"chtx"> | EnvironmentService>;
//# sourceMappingURL=index.d.ts.map