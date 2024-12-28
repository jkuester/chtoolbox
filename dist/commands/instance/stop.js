"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stop = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
const stopChtInstances = (names) => (0, effect_1.pipe)(names, effect_1.Array.map(local_instance_1.LocalInstanceService.stop), effect_1.Effect.all);
const names = cli_1.Args
    .text({ name: 'name' })
    .pipe(cli_1.Args.withDescription('The project name of the CHT instance to stop'), cli_1.Args.atLeast(1));
exports.stop = cli_1.Command
    .make('stop', { names }, ({ names }) => stopChtInstances(names)
    .pipe(effect_1.Effect.andThen(effect_1.Console.log('CHT instance(s) stopped'))))
    .pipe(cli_1.Command.withDescription(`LOCAL ONLY: Stop a local CHT instance. Data for the instance is not removed. Requires Docker and Docker Compose.`));
//# sourceMappingURL=stop.js.map