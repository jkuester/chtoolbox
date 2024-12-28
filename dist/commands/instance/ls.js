"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ls = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
exports.ls = cli_1.Command
    .make('ls', {}, () => local_instance_1.LocalInstanceService
    .ls()
    .pipe(effect_1.Effect.map(effect_1.Array.map(name => effect_1.Console.log(name))), effect_1.Effect.flatMap(effect_1.Effect.all)))
    .pipe(cli_1.Command.withDescription(`LOCAL ONLY: List the local CHT instances. Requires Docker and Docker Compose.`));
//# sourceMappingURL=ls.js.map