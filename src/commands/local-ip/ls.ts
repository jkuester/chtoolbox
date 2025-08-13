import { Command } from '@effect/cli';
import { Array, Console, Effect, pipe, Record } from 'effect';
import { getLocalIpUrl } from '../../libs/local-network.ts';
import { LocalIpService } from '../../services/local-ip.ts';

export const printLocalIpInstances = Effect.fn((ports: { from: number, to: number }[]) => pipe(
  ports,
  Array.map(({ from, to }) => ({ to, url: getLocalIpUrl(from.toString() as `${number}`) })),
  Array.reduce({}, (dict, { to, url }) => Record.set(dict, to.toString(), url)),
  Console.table,
));

export const ls = Command
  .make('ls', {}, Effect.fn(() => LocalIpService
    .ls()
    .pipe(Effect.flatMap(printLocalIpInstances))))
  .pipe(Command.withDescription(
    `LOCAL ONLY: List the nginx-local-ip instances and their URLs. Requires Docker.`
  ));
