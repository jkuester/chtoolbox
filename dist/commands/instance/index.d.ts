import { Command } from '@effect/cli';
export declare const instance: Command.Command<"instance", import("@effect/platform/FileSystem").FileSystem | import("../../services/local-instance.ts").LocalInstanceService | import("@effect/platform/Terminal").Terminal, Error | import("@effect/platform/Error").PlatformError, {
    readonly subcommand: import("effect/Option").Option<{
        readonly names: [string, ...string[]];
        readonly yes: boolean;
    } | {
        readonly names: [string, ...string[]];
        readonly version: string;
        readonly directory: import("effect/Option").Option<string>;
    } | {
        readonly names: string[];
    } | {
        readonly names: [string, ...string[]];
        readonly type: "expired" | "local-ip" | "self-signed";
    } | {
        readonly names: [string, ...string[]];
        readonly directory: import("effect/Option").Option<string>;
    } | {
        readonly names: [string, ...string[]];
    }>;
}>;
//# sourceMappingURL=index.d.ts.map