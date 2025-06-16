import { Command } from '@effect/cli';
export declare const instance: Command.Command<"instance", import("@effect/platform/Terminal").Terminal | import("@effect/platform/FileSystem").FileSystem | import("../../services/local-instance.js").LocalInstanceService, Error | import("@effect/platform/Error").PlatformError | import("@effect/platform/Terminal").QuitException, {
    readonly subcommand: import("effect/Option").Option<{
        readonly names: string[];
    } | {
        readonly names: [string, ...string[]];
        readonly version: string;
        readonly directory: import("effect/Option").Option<string>;
    } | {
        readonly names: [string, ...string[]];
        readonly yes: boolean;
    } | {
        readonly names: [string, ...string[]];
    } | {
        readonly names: [string, ...string[]];
        readonly directory: import("effect/Option").Option<string>;
    } | {
        readonly names: [string, ...string[]];
        readonly type: "local-ip" | "expired" | "self-signed";
    }>;
}>;
//# sourceMappingURL=index.d.ts.map