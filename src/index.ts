#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Option, Redacted, String } from 'effect';
import { ChtClientService } from './services/cht-client.ts';
import { monitor } from './commands/monitor.ts';
import packageJson from '../package.json' with { type: 'json' };
import { EnvironmentService, } from './services/environment.ts';
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
import { SentinelBacklogService } from './services/sentinel-backlog.js';
import { sentinelBacklog } from './commands/sentinel-backlog/index.js';

const url = Options
  .text('url')
  .pipe(
    Options.withDescription(
      'The URL of the CouchDB server. Defaults to the COUCH_URL environment variable. Note that since this tool is ' +
      'intended for testing/development usage, invalid SSL certificates (e.g. self-signed) are allowed by default.'
    ),
    Options.optional
  );

const chtx = Command.make('chtx', { url });

const setEnv = (url: Redacted.Redacted) => Effect.flatMap(EnvironmentService, envSvc => envSvc.setUrl(url));
const getEnv = Effect.flatMap(EnvironmentService, envSvc => envSvc.get());

export const initializeUrl = chtx.pipe(
  Effect.map(({ url }) => url),
  Effect.map(Option.map(Redacted.make)),
  Effect.map(Option.map(setEnv)),
  Effect.flatMap(Option.getOrElse(() => getEnv)),
  Effect.map(({ url }) => Redacted.value(url)),
  Effect.map(Option.liftPredicate(String.isNonEmpty)),
  Effect.map(Option.getOrThrowWith(() => new Error(
    'A value must be set for the COUCH_URL envar or the --url option.'
  ))),
);

const command = chtx.pipe(Command.withSubcommands([
  design, doc, localIp, monitor, warmViews, activeTasks, db, upgrade, instance, sentinelBacklog
]));

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  version: packageJson.version
});

const httpClientNoSslVerify = Layer.provide(NodeHttpClient.layerWithoutAgent.pipe(
  Layer.provide(NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))
));

cli(process.argv)
  .pipe(
    Effect.provide(CompactService.Default),
    Effect.provide(MonitorService.Default),
    Effect.provide(LocalDiskUsageService.Default),
    Effect.provide(LocalInstanceService.Default.pipe(httpClientNoSslVerify)),
    Effect.provide(LocalIpService.Default),
    Effect.provide(PurgeService.Default),
    Effect.provide(UpgradeService.Default),
    Effect.provide(WarmViewsService.Default),
    Effect.provide(ReplicateService.Default),
    Effect.provide(SentinelBacklogService.Default),
    Effect.provide(TestDataGeneratorService.Default),
    Effect.provide(PouchDBService.Default),
    Effect.provide(ChtClientService.Default.pipe(httpClientNoSslVerify)),
    Effect.provide(EnvironmentService.Default),
    Effect.provide(NodeContext.layer),
    NodeRuntime.runMain
  );
