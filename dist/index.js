#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("@effect/cli");
const platform_node_1 = require("@effect/platform-node");
const effect_1 = require("effect");
const node_system_1 = require("./services/couch/node-system");
const couch_1 = require("./services/couch/couch");
const dbs_info_1 = require("./services/couch/dbs-info");
const monitor_1 = require("./commands/monitor");
const package_json_1 = __importDefault(require("../package.json"));
const chtx = cli_1.Command.make('chtx', {}, () => (0, effect_1.pipe)('Hello world!', effect_1.Console.log));
const command = chtx.pipe(cli_1.Command.withSubcommands([monitor_1.monitor]));
const cli = cli_1.Command.run(command, {
    name: 'CHT Toolbox',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    version: package_json_1.default.version
});
// Prepare and run the CLI application
cli(process.argv)
    .pipe(effect_1.Effect.provide(platform_node_1.NodeContext.layer), effect_1.Effect.provide(couch_1.CouchServiceLive), effect_1.Effect.provide(node_system_1.CouchNodeSystemServiceLive), effect_1.Effect.provide(dbs_info_1.CouchDbsInfoServiceLive), platform_node_1.NodeRuntime.runMain);
//# sourceMappingURL=index.js.map