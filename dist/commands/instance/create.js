import { FileSystem } from '@effect/platform';
import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { LocalInstanceService } from "../../services/local-instance.js";
import { clearThen } from "../../libs/console.js";
import { printInstanceTable } from "./ls.js";
const createChtInstances = Effect.fn((names, version, directory) => directory.pipe(Option.map(dir => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.realPath(dir)))), Effect.transposeOption, Effect.flatMap(dirPath => pipe(names, Array.map(name => LocalInstanceService.create(name, version, dirPath.pipe(Option.map(path => `${path}/${name}`)))), Effect.allWith({ concurrency: 0 })))));
const startChtInstances = Effect.fn((names) => pipe(names, Array.map(name => LocalInstanceService.start(name, Option.none())), Effect.allWith({ concurrency: 'unbounded' })));
const setLocalIpSSLCerts = Effect.fn((names) => pipe(names, Array.map(name => LocalInstanceService.setSSLCerts(name, 'local-ip')), Effect.allWith({ concurrency: 'unbounded' })));
const names = Args
    .text({ name: 'name' })
    .pipe(Args.withDescription('The name of the instance to create'), Args.atLeast(1));
const version = Options
    .text('cht-version')
    .pipe(Options.withAlias('v'), Options.withDescription('The CHT version (or branch name) to deploy. Defaults to the latest build from the master branch.'), Options.withDefault('master'));
const directory = Options
    .directory('directory', { exists: 'yes' })
    .pipe(Options.withAlias('d'), Options.withDescription('The local directory to store the instance data. If not specified, data will be stored in a Docker named volume.'
    + ' Data in this directory will NOT be automatically deleted when the instance is remove.'), Options.optional);
export const create = Command
    .make('create', { names, version, directory }, Effect.fn(({ names, version, directory }) => Console
    .log('Pulling Docker images (this may take awhile depending on network speeds)...')
    .pipe(Effect.andThen(createChtInstances(names, version, directory)), Effect.andThen(clearThen(Console.log('Starting instance(s)...'))), Effect.andThen(startChtInstances(names)), Effect.tap(setLocalIpSSLCerts(names)), Effect.flatMap(printInstanceTable))))
    .pipe(Command.withDescription(`LOCAL ONLY: Create (and start) a new local CHT instance. Requires Docker and Docker Compose.`));
