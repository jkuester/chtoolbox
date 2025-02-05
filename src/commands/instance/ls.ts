import { Command } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { LocalInstanceService } from '../../services/local-instance.js';
import { getLocalIpUrl } from '../../libs/local-network.js';
import { color } from '../../libs/console.js';

const getUrl = (port: Option.Option<`${number}`>) => port.pipe(
  Option.map(getLocalIpUrl),
  Option.getOrElse(() => ''),
);

const printInstanceInfo = ({ name, port }: { name: string, port: Option.Option<`${number}`> }) => pipe(
  getUrl(port),
  color('blue'),
  url => Console.log(`${name} - ${url}`),
);

export const ls = Command
  .make('ls', {}, () => LocalInstanceService
    .ls()
    .pipe(
      Effect.map(Array.map(printInstanceInfo)),
      Effect.flatMap(Effect.all),
    ))
  .pipe(Command.withDescription(
    `LOCAL ONLY: List the local CHT instances. Requires Docker and Docker Compose.`
  ));
