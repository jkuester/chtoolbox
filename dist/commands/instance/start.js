"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
const create_1 = require("./create");
const startChtInstances = (names) => (0, effect_1.pipe)(names, effect_1.Array.map(local_instance_1.LocalInstanceService.start), effect_1.Effect.all);
const names = cli_1.Args
    .text({ name: 'name' })
    .pipe(cli_1.Args.withDescription('The project name of the CHT instance to start'), cli_1.Args.atLeast(1));
exports.start = cli_1.Command
    .make('start', { names }, ({ names }) => startChtInstances(names)
    .pipe(effect_1.Effect.flatMap((0, create_1.printInstanceInfo)(names))))
    .pipe(cli_1.Command.withDescription('LOCAL ONLY: Start a local CHT instance. The instance must already have been created. ' +
    'Requires Docker and Docker Compose.'));
//# sourceMappingURL=start.js.map