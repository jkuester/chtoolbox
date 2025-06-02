import { Command } from '@effect/cli';
import { Array, Console, Effect, pipe, Record } from 'effect';
import { getLocalIpUrl } from '../../libs/local-network.js';
import { LocalIpService } from '../../services/local-ip.js';
export const printLocalIpInstances = (ports) => pipe(ports, Array.map(({ from, to }) => ({ to, url: getLocalIpUrl(from.toString()) })), Array.reduce({}, (dict, { to, url }) => Record.set(dict, to.toString(), url)), Console.table);
export const ls = Command
    .make('ls', {}, () => LocalIpService
    .ls()
    .pipe(Effect.flatMap(printLocalIpInstances)))
    .pipe(Command.withDescription(`LOCAL ONLY: List the nginx-local-ip instances and their URLs. Requires Docker.`));
//# sourceMappingURL=ls.js.map