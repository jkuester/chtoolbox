#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Config, Console, Effect, Option, pipe, Redacted } from 'effect';
import { CouchNodeSystemServiceLive } from './services/couch/node-system';
import { CouchServiceLive } from './services/couch/couch';
import { CouchDbsInfoServiceLive } from './services/couch/dbs-info';
import { monitor } from './commands/monitor';
import packageJson from '../package.json';
import { EnvironmentService, EnvironmentServiceLive, } from './services/environment';
import { CouchDesignInfoServiceLive } from './services/couch/design-info';
import { optionalUpdate } from './libs/core';
import { MonitorServiceLive } from './services/monitor';
import { LocalDiskUsageServiceLive } from './services/local-disk-usage';

const url = Options
  .text('url')
  .pipe(
    Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable.'),
    Options.optional
  );

const chtx = Command.make('chtx', { url }, () => pipe(
  'Hello World!',
  Console.log,
));

export const initializeUrl = chtx.pipe(
  Effect.map(({ url }) => url),
  Effect.map(Option.map(Redacted.make)),
  Effect.map(Option.map(Config.succeed)),
  Effect.flatMap(urlConfig => EnvironmentService.pipe(
    Effect.flatMap(env => optionalUpdate(env.url, urlConfig))
  )),
);

const command = chtx.pipe(Command.withSubcommands([monitor]));

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  version: packageJson.version
});

cli(process.argv)
  .pipe(
    Effect.provide(NodeContext.layer),
    Effect.provide(NodeHttpClient.layer),
    Effect.provide(EnvironmentServiceLive),
    Effect.provide(CouchServiceLive),
    Effect.provide(CouchNodeSystemServiceLive),
    Effect.provide(CouchDbsInfoServiceLive),
    Effect.provide(CouchDesignInfoServiceLive),
    Effect.provide(LocalDiskUsageServiceLive),
    Effect.provide(MonitorServiceLive),
    NodeRuntime.runMain
  );
