#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Array, Effect, Layer, pipe } from 'effect';
import { ChtClientService } from './services/cht-client.ts';
import { monitor } from './commands/monitor.ts';
import packageJson from '../package.json' with { type: 'json' };
import { MonitorService } from './services/monitor.ts';
import { LocalDiskUsageService } from './services/local-disk-usage.ts';
import { WarmViewsService } from './services/warm-views.ts';
import { warmViews } from './commands/warm-views.ts';
import { CompactService } from './services/compact.ts';
import { activeTasks } from './commands/active-tasks.ts';
import { PouchDBService } from './services/pouchdb.ts';
import { ReplicateService } from './services/replicate.ts';
import { db } from './commands/db/index.ts';
import { design } from './commands/design/index.ts';
import { doc } from './commands/doc/index.ts';
import { PurgeService } from './services/purge.ts';
import { upgrade } from './commands/upgrade.ts';
import { UpgradeService } from './services/upgrade.ts';
import { TestDataGeneratorService } from './services/test-data-generator.ts';
import { instance } from './commands/instance/index.ts';
import { LocalInstanceService } from './services/local-instance.ts';
import { localIp } from './commands/local-ip/index.ts';
import { LocalIpService } from './services/local-ip.ts';
import { SentinelBacklogService } from './services/sentinel-backlog.ts';
import { sentinelBacklog } from './commands/sentinel-backlog/index.ts';
import { getChtxConfigProvider } from './libs/config.js';

const withChtxConfigProvider = Effect.fn(<A, E, R>(
  effect: Effect.Effect<A, E, R>
) => pipe(
    chtx,
    Effect.flatMap(getChtxConfigProvider),
    Effect.flatMap(configProvider => pipe(
      effect,
      Effect.withConfigProvider(configProvider)
    )),
  ));

const subCommandWithConfig = <N extends string, R, E, A>(cmd: Command.Command<N, R, E, A>) => pipe(
  cmd,
  Command.transformHandler(withChtxConfigProvider)
);

// Could not find a way to map the subcommands through subCommandWithConfig without running into issues with TS trying
// to infer a union type that gets really janky with the service tags.
const SUBCOMMANDS = Array.make(
  subCommandWithConfig(design),
  subCommandWithConfig(doc),
  subCommandWithConfig(localIp),
  subCommandWithConfig(monitor),
  subCommandWithConfig(warmViews),
  subCommandWithConfig(activeTasks),
  subCommandWithConfig(db),
  subCommandWithConfig(upgrade),
  subCommandWithConfig(instance),
  subCommandWithConfig(sentinelBacklog)
);

const url = Options
  .text('url')
  .pipe(
    Options.withDescription(
      'The URL of the CHT/CouchDB server. Defaults to the COUCH_URL environment variable. You can include the admin ' +
      'user credentials in this URL value or specify the CHT_USERNAME and CHT_PASSWORD config values separately. ' +
      'Note that since this tool is intended for testing/development usage, invalid SSL certificates (e.g. ' +
      'self-signed) are allowed by default.'
    ),
    Options.optional
  );

const chtx = Command.make('chtx', { url });

const command = chtx.pipe(
  Command.withSubcommands(SUBCOMMANDS),
);

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  version: packageJson.version
});

const httpClientNoSslVerify = Layer.provide(NodeHttpClient.layerWithoutAgent.pipe(
  Layer.provide(NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))
));

pipe(
  cli(process.argv),
  Effect.provide(MonitorService.Default),
  Effect.provide(LocalDiskUsageService.Default),
  Effect.provide(LocalInstanceService.Default.pipe(httpClientNoSslVerify)),
  Effect.provide(LocalIpService.Default),
  Effect.provide(PurgeService.Default),
  Effect.provide(UpgradeService.Default),
  Effect.provide(CompactService.Default),
  Effect.provide(WarmViewsService.Default),
  Effect.provide(ReplicateService.Default),
  Effect.provide(SentinelBacklogService.Default),
  Effect.provide(TestDataGeneratorService.Default),
  Effect.provide(PouchDBService.Default),
  Effect.provide(ChtClientService.Default.pipe(httpClientNoSslVerify)),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);
