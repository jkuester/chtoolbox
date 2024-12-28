import { Command } from '@effect/cli';
export declare const instance: Command.Command<"instance", import("@effect/platform/Terminal").Terminal | import("../../services/local-instance").LocalInstanceService, Error | import("@effect/platform/Terminal").QuitException, {
    readonly subcommand: import("effect/Option").Option<{
        readonly names: [string, ...string[]];
        readonly version: string;
    } | {
        readonly names: [string, ...string[]];
        readonly yes: boolean;
    } | {
        readonly names: [string, ...string[]];
    } | {
        readonly names: [string, ...string[]];
    } | {
        readonly names: [string, ...string[]];
        readonly type: "local-ip" | "expired" | "self-signed";
    } | {}>;
}>;
//# sourceMappingURL=index.d.ts.map