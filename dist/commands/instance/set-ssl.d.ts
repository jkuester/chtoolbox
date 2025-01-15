import { Command } from '@effect/cli';
import { LocalInstanceService } from '../../services/local-instance.js';
export declare const setSSL: Command.Command<"set-ssl", LocalInstanceService, Error, {
    readonly names: [string, ...string[]];
    readonly type: "local-ip" | "expired" | "self-signed";
}>;
//# sourceMappingURL=set-ssl.d.ts.map