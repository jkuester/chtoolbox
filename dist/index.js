#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeUrl = void 0;
const cli_1 = require("@effect/cli");
const platform_node_1 = require("@effect/platform-node");
const effect_1 = require("effect");
const cht_client_1 = require("./services/cht-client");
const monitor_1 = require("./commands/monitor");
const package_json_1 = __importDefault(require("../package.json"));
const environment_1 = require("./services/environment");
const monitor_2 = require("./services/monitor");
const local_disk_usage_1 = require("./services/local-disk-usage");
const warm_views_1 = require("./services/warm-views");
const warm_views_2 = require("./commands/warm-views");
const compact_1 = require("./services/compact");
const active_tasks_1 = require("./commands/active-tasks");
const pouchdb_1 = require("./services/pouchdb");
const replicate_1 = require("./services/replicate");
const db_1 = require("./commands/db");
const design_1 = require("./commands/design");
const doc_1 = require("./commands/doc");
const purge_1 = require("./services/purge");
const upgrade_1 = require("./commands/upgrade");
const upgrade_2 = require("./services/cht/upgrade");
const upgrade_3 = require("./services/upgrade");
const test_data_generator_1 = require("./services/test-data-generator");
const instance_1 = require("./commands/instance");
const local_instance_1 = require("./services/local-instance");
const url = cli_1.Options
    .text('url')
    .pipe(cli_1.Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable. Note that since this tool is ' +
    'intended for testing/development usage, invalid SSL certificates (e.g. self-signed) are allowed by default.'), cli_1.Options.optional);
const chtx = cli_1.Command.make('chtx', { url });
const setEnv = (url) => effect_1.Effect.flatMap(environment_1.EnvironmentService, envSvc => envSvc.setUrl(url));
const getEnv = effect_1.Effect.flatMap(environment_1.EnvironmentService, envSvc => envSvc.get());
exports.initializeUrl = chtx.pipe(effect_1.Effect.map(({ url }) => url), effect_1.Effect.map(effect_1.Option.map(effect_1.Redacted.make)), effect_1.Effect.map(effect_1.Option.map(setEnv)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => getEnv)), effect_1.Effect.map(({ url }) => effect_1.Redacted.value(url)), effect_1.Effect.map(effect_1.Option.liftPredicate(effect_1.String.isNonEmpty)), effect_1.Effect.map(effect_1.Option.getOrThrowWith(() => new Error('A value must be set for the COUCH_URL envar or the --url option.'))));
const command = chtx.pipe(cli_1.Command.withSubcommands([
    design_1.design, doc_1.doc, monitor_1.monitor, warm_views_2.warmViews, active_tasks_1.activeTasks, db_1.db, upgrade_1.upgrade, instance_1.instance
]));
const cli = cli_1.Command.run(command, {
    name: 'CHT Toolbox',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    version: package_json_1.default.version
});
const httpClientNoSslVerify = effect_1.Layer.provide(platform_node_1.NodeHttpClient.layerWithoutAgent.pipe(effect_1.Layer.provide(platform_node_1.NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))));
cli(process.argv)
    .pipe(effect_1.Effect.provide(compact_1.CompactService.Default), effect_1.Effect.provide(monitor_2.MonitorService.Default), effect_1.Effect.provide(local_disk_usage_1.LocalDiskUsageService.Default), effect_1.Effect.provide(local_instance_1.LocalInstanceService.Default.pipe(httpClientNoSslVerify)), effect_1.Effect.provide(purge_1.PurgeService.Default), effect_1.Effect.provide(upgrade_3.UpgradeService.Default), effect_1.Effect.provide(warm_views_1.WarmViewsService.Default), effect_1.Effect.provide(replicate_1.ReplicateService.Default), effect_1.Effect.provide(upgrade_2.ChtUpgradeService.Default), effect_1.Effect.provide(test_data_generator_1.TestDataGeneratorService.Default), effect_1.Effect.provide(pouchdb_1.PouchDBService.Default), effect_1.Effect.provide(cht_client_1.ChtClientService.Default.pipe(httpClientNoSslVerify)), effect_1.Effect.provide(environment_1.EnvironmentService.Default), effect_1.Effect.provide(platform_node_1.NodeContext.layer), platform_node_1.NodeRuntime.runMain);
//# sourceMappingURL=index.js.map