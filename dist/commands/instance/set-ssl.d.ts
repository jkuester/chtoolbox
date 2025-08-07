import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance.ts';
export declare const setSSL: Command.Command<"set-ssl", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
    readonly type: "expired" | "local-ip" | "self-signed";
}>;
//# sourceMappingURL=set-ssl.d.ts.map