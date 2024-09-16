#!/usr/bin/env node
import { Command } from '@effect/cli';
import { Effect, Option } from 'effect';
import { EnvironmentService } from './services/environment';
export declare const populateUrl: (url: Option.Option<string>) => Effect.Effect<string, never, EnvironmentService>;
export declare const chtx: Command.Command<"chtx", EnvironmentService, never, {
    readonly url: Option.Option<string>;
}>;
//# sourceMappingURL=index.d.ts.map