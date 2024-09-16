#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chtx = exports.populateUrl = void 0;
const cli_1 = require("@effect/cli");
const platform_node_1 = require("@effect/platform-node");
const effect_1 = require("effect");
const node_system_1 = require("./services/couch/node-system");
const couch_1 = require("./services/couch/couch");
const dbs_info_1 = require("./services/couch/dbs-info");
const monitor_1 = require("./commands/monitor");
const package_json_1 = __importDefault(require("../package.json"));
const environment_1 = require("./services/environment");
const url = cli_1.Options
    .text('url')
    .pipe(cli_1.Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable.'), cli_1.Options.optional);
const populateUrl = (url) => environment_1.EnvironmentService.pipe(effect_1.Effect.flatMap(env => env.url.pipe(effect_1.Ref.get, effect_1.Effect.map(envUrl => url.pipe(effect_1.Option.getOrElse(() => envUrl))), effect_1.Effect.tap(urlValue => effect_1.Ref.update(env.url, () => urlValue)))));
exports.populateUrl = populateUrl;
exports.chtx = cli_1.Command.make('chtx', { url }, ({ url }) => (0, effect_1.pipe)(environment_1.EnvironmentService, effect_1.Effect.tap(env => env.url.pipe(effect_1.Ref.get, effect_1.Effect.tap(effect_1.Console.log))), effect_1.Effect.andThen((0, exports.populateUrl)(url)), effect_1.Effect.andThen(environment_1.EnvironmentService), effect_1.Effect.tap(env => env.url.pipe(effect_1.Ref.get, effect_1.Effect.tap(effect_1.Console.log)))));
const command = exports.chtx.pipe(cli_1.Command.withSubcommands([monitor_1.monitor]));
const cli = cli_1.Command.run(command, {
    name: 'CHT Toolbox',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    version: package_json_1.default.version
});
cli(process.argv)
    .pipe(effect_1.Effect.provide(platform_node_1.NodeContext.layer), effect_1.Effect.provide(effect_1.Layer
    .merge(node_system_1.CouchNodeSystemServiceLive, dbs_info_1.CouchDbsInfoServiceLive)
    .pipe(effect_1.Layer.provide(couch_1.CouchServiceLive), effect_1.Layer.provideMerge(environment_1.EnvironmentServiceLive), effect_1.Layer.provide(platform_node_1.NodeHttpClient.layer))), platform_node_1.NodeRuntime.runMain);
//# sourceMappingURL=index.js.map