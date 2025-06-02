import { Command } from '@effect/cli';
export declare const localIp: Command.Command<"local-ip", import("../../services/local-ip.js").LocalIpService, Error, {
    readonly subcommand: import("effect/Option").Option<{} | {
        readonly toPort: number;
        readonly fromPort: import("effect/Option").Option<number>;
    } | {
        readonly toPorts: [number, ...number[]];
    }>;
}>;
//# sourceMappingURL=index.d.ts.map