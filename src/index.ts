#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Option, Redacted, String } from 'effect';
import { CouchNodeSystemService } from './services/couch/node-system';
import { ChtClientService } from './services/cht-client';
import { CouchDbsInfoService } from './services/couch/dbs-info';
import { monitor } from './commands/monitor';
import packageJson from '../package.json';
import { EnvironmentService, } from './services/environment';
import { CouchDesignInfoService } from './services/couch/design-info';
import { MonitorService } from './services/monitor';
import { LocalDiskUsageService } from './services/local-disk-usage';
import { CouchDesignService } from './services/couch/design';
import { CouchViewService } from './services/couch/view';
import { CouchDesignDocsService } from './services/couch/design-docs';
import { WarmViewsService } from './services/warm-views';
import { warmViews } from './commands/warm-views';
import { CouchCompactService } from './services/couch/compact';
import { CompactService } from './services/compact';
import { compact } from './commands/compact';
import { activeTasks } from './commands/active-tasks';
import { CouchActiveTasksService } from './services/couch/active-tasks';
import { PouchDBService } from './services/pouchdb';
import { ReplicateService } from './services/replicate';
import { db } from './commands/db';
import { design } from './commands/design';
import { doc } from './commands/doc';
import { CouchPurgeService } from './services/couch/purge';
import { PurgeService } from './services/purge';

const url = Options
  .text('url')
  .pipe(
    Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable.'),
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

const command = chtx.pipe(Command.withSubcommands([compact, design, doc, monitor, warmViews, activeTasks, db]));

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  version: packageJson.version
});

cli(process.argv)
  .pipe(
    Effect.provide(CompactService.Default),
    Effect.provide(MonitorService.Default),
    Effect.provide(LocalDiskUsageService.Default),
    Effect.provide(PurgeService.Default),
    Effect.provide(WarmViewsService.Default),
    Effect.provide(ReplicateService.Default),
    Effect.provide(CouchActiveTasksService.Default),
    Effect.provide(CouchCompactService.Default),
    Effect.provide(CouchNodeSystemService.Default),
    Effect.provide(CouchDbsInfoService.Default),
    Effect.provide(CouchDesignDocsService.Default),
    Effect.provide(CouchDesignInfoService.Default),
    Effect.provide(CouchDesignService.Default),
    Effect.provide(CouchPurgeService.Default),
    Effect.provide(CouchViewService.Default),
    Effect.provide(PouchDBService.Default),
    Effect.provide(ChtClientService.Default.pipe(
      Layer.provide(NodeHttpClient.layerWithoutAgent.pipe(
        Layer.provide(NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))
      )),
    )),
    Effect.provide(EnvironmentService.Default),
    Effect.provide(NodeContext.layer),
    NodeRuntime.runMain
  );
