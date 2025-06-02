import { Args, Command, Options } from '@effect/cli';
import { Effect, Array } from 'effect';
import { LocalIpService } from '../../services/local-ip.js';
import { printLocalIpInstances } from './ls.js';

const toPort = Args
  .integer({ name: 'to' })
  .pipe(Args.withDescription(
    'The port requests will be proxied to. This should be the port your service is running on.'
  ));

const fromPort = Options
  .integer('from')
  .pipe(
    Options.withDescription(
      'The port requests will be proxied from. This is the port the local-ip instance will listen on. '
      + 'If no from port is specified, a random open port will be used.'
    ),
    Options.optional,
  );

export const create = Command
  .make('create', { toPort, fromPort }, ({ toPort, fromPort }) => LocalIpService
    .create(toPort, fromPort)
    .pipe(
      Effect.map(from => ({ from, to: toPort })),
      Effect.map(Array.make),
      Effect.flatMap(printLocalIpInstances),
    ))
  .pipe(Command.withDescription(
    `LOCAL ONLY: Create (and start) a new nginx-local-ip instance. Requires Docker.`
  ));
