"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ls = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
const local_network_1 = require("../../libs/local-network");
const console_1 = require("../../libs/console");
const getUrl = (port) => port.pipe(effect_1.Option.map(local_network_1.getLocalIpUrl), effect_1.Option.getOrElse(() => ''));
const printInstanceInfo = ({ name, port }) => (0, effect_1.pipe)(getUrl(port), (0, console_1.color)('blue'), url => effect_1.Console.log(`${name} - ${url}`));
exports.ls = cli_1.Command
    .make('ls', {}, () => local_instance_1.LocalInstanceService
    .ls()
    .pipe(effect_1.Effect.map(effect_1.Array.map(printInstanceInfo)), effect_1.Effect.flatMap(effect_1.Effect.all)))
    .pipe(cli_1.Command.withDescription(`LOCAL ONLY: List the local CHT instances. Requires Docker and Docker Compose.`));
//# sourceMappingURL=ls.js.map