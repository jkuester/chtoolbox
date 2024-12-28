"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = exports.printInstanceInfo = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
const local_network_1 = require("../../libs/local-network");
const console_1 = require("../../libs/console");
const createChtInstances = (names, version) => (0, effect_1.pipe)(names, effect_1.Array.map(name => local_instance_1.LocalInstanceService.create(name, version)), effect_1.Effect.allWith({ concurrency: 0 }));
const startChtInstances = (names) => (0, effect_1.pipe)(names, effect_1.Array.map(local_instance_1.LocalInstanceService.start), effect_1.Effect.all);
const setLocalIpSSLCerts = (names) => (0, effect_1.pipe)(names, effect_1.Array.map(name => local_instance_1.LocalInstanceService.setSSLCerts(name, 'local-ip')), effect_1.Effect.all);
const printInstanceInfo = (names) => (ports) => effect_1.Console
    .log(`
Instance(s) started!

  Username: ${(0, effect_1.pipe)('medic', (0, console_1.color)('green'))}
  Password: ${(0, effect_1.pipe)('password', (0, console_1.color)('green'))}

`)
    .pipe(effect_1.Effect.andThen((0, effect_1.pipe)(ports, effect_1.Array.map(local_network_1.getLocalIpUrl), effect_1.Array.map((0, console_1.color)('blue')), effect_1.Array.zip(names), effect_1.Array.map(([url, name]) => effect_1.Console.log(`${name} - ${url}`)), effect_1.Effect.all)));
exports.printInstanceInfo = printInstanceInfo;
const names = cli_1.Args
    .text({ name: 'name' })
    .pipe(cli_1.Args.withDescription('The name of the database to create'), cli_1.Args.atLeast(1));
const version = cli_1.Options
    .text('version')
    .pipe(cli_1.Options.withAlias('v'), cli_1.Options.withDescription('The CHT version (or branch name) to deploy. Defaults to the latest build from the master branch.'), cli_1.Options.withDefault('master'));
exports.create = cli_1.Command
    .make('create', { names, version }, ({ names, version }) => effect_1.Console
    .log('Pulling Docker images (this may take awhile depending on network speeds)...')
    .pipe(effect_1.Effect.andThen(createChtInstances(names, version)), effect_1.Effect.andThen(effect_1.Console.log('Starting instance(s)...')), effect_1.Effect.andThen(startChtInstances(names)), effect_1.Effect.tap(setLocalIpSSLCerts(names)), effect_1.Effect.flatMap((0, exports.printInstanceInfo)(names))))
    .pipe(cli_1.Command.withDescription(`LOCAL ONLY: Create (and start) a new local CHT instance. Requires Docker and Docker Compose.`));
//# sourceMappingURL=create.js.map