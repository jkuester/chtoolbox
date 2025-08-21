import { Args, Command, Options } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { LocalInstanceService, type SSLType } from '../../services/local-instance.ts';

const setSSLCertOnInstances = Effect.fn((names: string[], type: SSLType) => pipe(
  names,
  Array.map(name => LocalInstanceService.setSSLCerts(name, type)),
  Effect.allWith({ concurrency: 'unbounded' }),
));

const type = Options
  .choice('type', ['local-ip', 'self-signed', 'expired'])
  .pipe(
    Options.withAlias('t'),
    Options.withDescription('Type of SSL cert to set.'),
  );

const names = Args
  .text({ name: 'name' })
  .pipe(
    Args.withDescription('The project name of the CHT instance to set the SSL certs on'),
    Args.atLeast(1),
  );

export const setSSL = Command
  .make('set-ssl', { names, type }, ({ names, type }) => setSSLCertOnInstances(names, type))
  .pipe(Command.withDescription(
    `LOCAL ONLY: Set the SSL certs on a local CHT instance. Requires Docker and Docker Compose.`
  ));
