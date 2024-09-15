#!/usr/bin/env node
import { Command } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Console, Effect, Layer, pipe } from 'effect';
import { CouchNodeSystemServiceLive } from './services/couch/node-system';
import { CouchServiceLive } from './services/couch/couch';
import { CouchDbsInfoServiceLive } from './services/couch/dbs-info';
import { monitor } from './commands/monitor';
import packageJson from '../package.json';
import { EnvironmentServiceLive } from './services/environment';

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

cli(process.argv)
  .pipe(
    Effect.provide(NodeContext.layer),
    Effect.provide(Layer
      .merge(CouchNodeSystemServiceLive, CouchDbsInfoServiceLive)
      .pipe(
        Layer.provide(CouchServiceLive),
        Layer.provide(EnvironmentServiceLive),
        Layer.provide(NodeHttpClient.layer)
      )),
    NodeRuntime.runMain
  );
