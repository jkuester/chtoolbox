import { Args, Command, Options } from '@effect/cli';
import { Array, Effect, pipe, Option } from 'effect';
import { LocalInstanceService } from "../../services/local-instance.js";
import { printInstanceTable } from "./ls.js";
const startChtInstances = (names, directory) => pipe(names, Array.map(name => LocalInstanceService.start(name, directory.pipe(Option.map(dir => `${dir}/${name}`)))), Effect.allWith({ concurrency: 'unbounded' }));
const directory = Options
    .directory('directory', { exists: 'yes' })
    .pipe(Options.withAlias('d'), Options.withDescription('The local directory containing the instance data. This should ONLY be specified when recovering an instance '
    + 'which has had all its containers removed, but the data directory still exists. Provide the path to the PARENT '
    + 'directory of the instance data (the one containing the directory with your instance name).'), Options.optional);
const names = Args
    .text({ name: 'name' })
    .pipe(Args.withDescription('The project name of the CHT instance to start'), Args.atLeast(1));
export const start = Command
    .make('start', { names, directory }, ({ names, directory }) => startChtInstances(names, directory)
    .pipe(Effect.flatMap(printInstanceTable)))
    .pipe(Command.withDescription('LOCAL ONLY: Start a local CHT instance. The instance must already have been created. ' +
    'Requires Docker and Docker Compose.'));
