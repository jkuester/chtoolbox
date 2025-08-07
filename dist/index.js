#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Option, Redacted, String } from 'effect';
import { ChtClientService } from "./services/cht-client.js";
import { monitor } from "./commands/monitor.js";
import packageJson from '../package.json' with { type: 'json' };
import { EnvironmentService, } from "./services/environment.js";
import { MonitorService } from "./services/monitor.js";
import { LocalDiskUsageService } from "./services/local-disk-usage.js";
import { WarmViewsService } from "./services/warm-views.js";
import { warmViews } from "./commands/warm-views.js";
import { CompactService } from "./services/compact.js";
import { activeTasks } from "./commands/active-tasks.js";
import { PouchDBService } from "./services/pouchdb.js";
import { ReplicateService } from "./services/replicate.js";
import { db } from "./commands/db/index.js";
import { design } from "./commands/design/index.js";
import { doc } from "./commands/doc/index.js";
import { PurgeService } from "./services/purge.js";
import { upgrade } from "./commands/upgrade.js";
import { UpgradeService } from "./services/upgrade.js";
import { TestDataGeneratorService } from "./services/test-data-generator.js";
import { instance } from "./commands/instance/index.js";
import { LocalInstanceService } from "./services/local-instance.js";
import { localIp } from "./commands/local-ip/index.js";
import { LocalIpService } from "./services/local-ip.js";
const url = Options
    .text('url')
    .pipe(Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable. Note that since this tool is ' +
    'intended for testing/development usage, invalid SSL certificates (e.g. self-signed) are allowed by default.'), Options.optional);
const chtx = Command.make('chtx', { url });
const setEnv = (url) => Effect.flatMap(EnvironmentService, envSvc => envSvc.setUrl(url));
const getEnv = Effect.flatMap(EnvironmentService, envSvc => envSvc.get());
export const initializeUrl = chtx.pipe(Effect.map(({ url }) => url), Effect.map(Option.map(Redacted.make)), Effect.map(Option.map(setEnv)), Effect.flatMap(Option.getOrElse(() => getEnv)), Effect.map(({ url }) => Redacted.value(url)), Effect.map(Option.liftPredicate(String.isNonEmpty)), Effect.map(Option.getOrThrowWith(() => new Error('A value must be set for the COUCH_URL envar or the --url option.'))));
const command = chtx.pipe(Command.withSubcommands([
    design, doc, localIp, monitor, warmViews, activeTasks, db, upgrade, instance
]));
const cli = Command.run(command, {
    name: 'CHT Toolbox',
    version: packageJson.version
});
const httpClientNoSslVerify = Layer.provide(NodeHttpClient.layerWithoutAgent.pipe(Layer.provide(NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))));
cli(process.argv)
    .pipe(Effect.provide(CompactService.Default), Effect.provide(MonitorService.Default), Effect.provide(LocalDiskUsageService.Default), Effect.provide(LocalInstanceService.Default.pipe(httpClientNoSslVerify)), Effect.provide(LocalIpService.Default), Effect.provide(PurgeService.Default), Effect.provide(UpgradeService.Default), Effect.provide(WarmViewsService.Default), Effect.provide(ReplicateService.Default), Effect.provide(TestDataGeneratorService.Default), Effect.provide(PouchDBService.Default), Effect.provide(ChtClientService.Default.pipe(httpClientNoSslVerify)), Effect.provide(EnvironmentService.Default), Effect.provide(NodeContext.layer), NodeRuntime.runMain);
//# sourceMappingURL=index.js.map