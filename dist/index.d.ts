#!/usr/bin/env node
import { Command } from '@effect/cli';
import { Config, Effect, Option } from 'effect';
export declare const populateUrl: (url: Option.Option<string>) => Effect.Effect<Option.Option<Config.Config<string>>, never, never>;
export declare const chtx: Command.Command<"chtx", never, never, {
    readonly url: Option.Option<string>;
}>;
//# sourceMappingURL=index.d.ts.map