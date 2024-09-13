#!/usr/bin/env node
import { Command } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Console, Effect, pipe } from 'effect';
import { CouchNodeSystemServiceLive } from './services/couch/node-system';
import { CouchServiceLive } from './services/couch/couch';
import { CouchDbsInfoServiceLive } from './services/couch/dbs-info';
import { monitor } from './commands/monitor';
import packageJson from '../package.json';

const chtx = Command.make('chtx', {}, () => pipe(
  'Hello world!',
  Console.log,
));

const command = chtx.pipe(Command.withSubcommands([monitor]));

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  version: packageJson.version
});

// Prepare and run the CLI application
cli(process.argv)
  .pipe(
    Effect.provide(NodeContext.layer),
    Effect.provide(CouchServiceLive),
    Effect.provide(CouchNodeSystemServiceLive),
    Effect.provide(CouchDbsInfoServiceLive),
    NodeRuntime.runMain
  );
