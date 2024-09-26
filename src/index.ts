#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Config, Effect, Layer, Option, Redacted } from 'effect';
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
import { CouchDesignServiceLive } from './services/couch/design';
import { CouchViewServiceLive } from './services/couch/view';
import { CouchDesignDocsServiceLive } from './services/couch/design-docs';
import { WarmViewsServiceLive } from './services/warm-views';
import { warmViews } from './commands/warm-views';
import { CouchCompactServiceLive } from './services/couch/compact';
import { CompactServiceLive } from './services/compact';
import { compact } from './commands/compact';
import { activeTasks } from './commands/active-tasks';
import { CouchActiveTasksServiceLive } from './services/couch/active-tasks';

const url = Options
  .text('url')
  .pipe(
    Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable.'),
    Options.optional
  );

const chtx = Command.make('chtx', { url });

export const initializeUrl = chtx.pipe(
  Effect.map(({ url }) => url),
  Effect.map(Option.map(Redacted.make)),
  Effect.map(Option.map(Config.succeed)),
  Effect.flatMap(urlConfig => EnvironmentService.pipe(
    Effect.map(service => service.get()),
    Effect.flatMap(({ url }) => optionalUpdate(url, urlConfig)),
  )),
);

const command = chtx.pipe(Command.withSubcommands([compact, monitor, warmViews, activeTasks]));

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  version: packageJson.version
});

cli(process.argv)
  .pipe(
    Effect.provide(CouchActiveTasksServiceLive),
    Effect.provide(CompactServiceLive),
    Effect.provide(MonitorServiceLive),
    Effect.provide(LocalDiskUsageServiceLive),
    Effect.provide(WarmViewsServiceLive),
    Effect.provide(CouchActiveTasksServiceLive),
    Effect.provide(CouchCompactServiceLive),
    Effect.provide(CouchNodeSystemServiceLive),
    Effect.provide(CouchDbsInfoServiceLive),
    Effect.provide(CouchDesignDocsServiceLive),
    Effect.provide(CouchDesignInfoServiceLive),
    Effect.provide(CouchDesignServiceLive),
    Effect.provide(CouchViewServiceLive),
    Effect.provide(CouchServiceLive.pipe(
      Layer.provide(NodeHttpClient.layerWithoutAgent.pipe(
        Layer.provide(NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))
      )),
    )),
    Effect.provide(EnvironmentServiceLive),
    Effect.provide(NodeContext.layer),
    NodeRuntime.runMain
  );
