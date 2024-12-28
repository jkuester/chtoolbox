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
const node_system_1 = require("./services/couch/node-system");
const cht_client_1 = require("./services/cht-client");
const dbs_info_1 = require("./services/couch/dbs-info");
const monitor_1 = require("./commands/monitor");
const package_json_1 = __importDefault(require("../package.json"));
const environment_1 = require("./services/environment");
const design_info_1 = require("./services/couch/design-info");
const monitor_2 = require("./services/monitor");
const local_disk_usage_1 = require("./services/local-disk-usage");
const design_1 = require("./services/couch/design");
const view_1 = require("./services/couch/view");
const design_docs_1 = require("./services/couch/design-docs");
const warm_views_1 = require("./services/warm-views");
const warm_views_2 = require("./commands/warm-views");
const compact_1 = require("./services/couch/compact");
const compact_2 = require("./services/compact");
const active_tasks_1 = require("./commands/active-tasks");
const active_tasks_2 = require("./services/couch/active-tasks");
const pouchdb_1 = require("./services/pouchdb");
const replicate_1 = require("./services/replicate");
const db_1 = require("./commands/db");
const design_2 = require("./commands/design");
const doc_1 = require("./commands/doc");
const purge_1 = require("./services/couch/purge");
const purge_2 = require("./services/purge");
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
    design_2.design, doc_1.doc, monitor_1.monitor, warm_views_2.warmViews, active_tasks_1.activeTasks, db_1.db, upgrade_1.upgrade, instance_1.instance
]));
const cli = cli_1.Command.run(command, {
    name: 'CHT Toolbox',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    version: package_json_1.default.version
});
const couchServices = active_tasks_2.CouchActiveTasksService
    .Default
    .pipe(effect_1.Layer.provideMerge(compact_1.CouchCompactService.Default), effect_1.Layer.provideMerge(node_system_1.CouchNodeSystemService.Default), effect_1.Layer.provideMerge(dbs_info_1.CouchDbsInfoService.Default), effect_1.Layer.provideMerge(design_docs_1.CouchDesignDocsService.Default), effect_1.Layer.provideMerge(design_info_1.CouchDesignInfoService.Default), effect_1.Layer.provideMerge(design_1.CouchDesignService.Default), effect_1.Layer.provideMerge(purge_1.CouchPurgeService.Default), effect_1.Layer.provideMerge(view_1.CouchViewService.Default));
const httpClientNoSslVerify = effect_1.Layer.provide(platform_node_1.NodeHttpClient.layerWithoutAgent.pipe(effect_1.Layer.provide(platform_node_1.NodeHttpClient.makeAgentLayer({ rejectUnauthorized: false }))));
cli(process.argv)
    .pipe(effect_1.Effect.provide(compact_2.CompactService.Default), effect_1.Effect.provide(monitor_2.MonitorService.Default), effect_1.Effect.provide(local_disk_usage_1.LocalDiskUsageService.Default), effect_1.Effect.provide(local_instance_1.LocalInstanceService.Default.pipe(httpClientNoSslVerify)), effect_1.Effect.provide(purge_2.PurgeService.Default), effect_1.Effect.provide(upgrade_3.UpgradeService.Default), effect_1.Effect.provide(warm_views_1.WarmViewsService.Default), effect_1.Effect.provide(replicate_1.ReplicateService.Default), effect_1.Effect.provide(upgrade_2.ChtUpgradeService.Default), effect_1.Effect.provide(test_data_generator_1.TestDataGeneratorService.Default), effect_1.Effect.provide(couchServices), effect_1.Effect.provide(pouchdb_1.PouchDBService.Default), effect_1.Effect.provide(cht_client_1.ChtClientService.Default.pipe(httpClientNoSslVerify)), effect_1.Effect.provide(environment_1.EnvironmentService.Default), effect_1.Effect.provide(platform_node_1.NodeContext.layer), platform_node_1.NodeRuntime.runMain);
//# sourceMappingURL=index.js.map