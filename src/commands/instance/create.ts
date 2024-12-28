import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { LocalInstanceService } from '../../services/local-instance';
import { getLocalIpUrl } from '../../libs/local-network';
import { color } from '../../libs/console';

const createChtInstances = (names: string[], version: string) => pipe(
  names,
  Array.map(name => LocalInstanceService.create(name, version)),
  Effect.allWith({ concurrency: 0 }), // Avoid port conflicts
);

const startChtInstances = (names: string[]) => pipe(
  names,
  Array.map(LocalInstanceService.start),
  Effect.all,
);

const setLocalIpSSLCerts = (names: string[]) => pipe(
  names,
  Array.map(name => LocalInstanceService.setSSLCerts(name, 'local-ip')),
  Effect.all,
);

export const printInstanceInfo = (names: string[]) => (
  ports: `${number}`[]
): Effect.Effect<void> => Console
  .log(`
Instance(s) started!

  Username: ${pipe('medic', color('green'))}
  Password: ${pipe('password', color('green'))}

`)
  .pipe(Effect.andThen(pipe(
    ports,
    Array.map(getLocalIpUrl),
    Array.map(color('blue')),
    Array.zip(names),
    Array.map(([url, name]) => Console.log(`${name} - ${url}`)),
    Effect.all,
  )));

const names = Args
  .text({ name: 'name' })
  .pipe(
    Args.withDescription('The name of the database to create'),
    Args.atLeast(1),
  );

const version = Options
  .text('version')
  .pipe(
    Options.withAlias('v'),
    Options.withDescription(
      'The CHT version (or branch name) to deploy. Defaults to the latest build from the master branch.'
    ),
    Options.withDefault('master'),
  );

export const create = Command
  .make('create', { names, version }, ({ names, version }) => Console
    .log('Pulling Docker images (this may take awhile depending on network speeds)...')
    .pipe(
      Effect.andThen(createChtInstances(names, version)),
      Effect.andThen(Console.log('Starting instance(s)...')),
      Effect.andThen(startChtInstances(names)),
      Effect.tap(setLocalIpSSLCerts(names)),
      Effect.flatMap(printInstanceInfo(names))
    ))
  .pipe(Command.withDescription(
    `LOCAL ONLY: Create (and start) a new local CHT instance. Requires Docker and Docker Compose.`
  ));
