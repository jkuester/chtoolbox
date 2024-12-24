"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSSL = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
const setSSLCertOnInstances = (names, type) => (0, effect_1.pipe)(names, effect_1.Array.map(name => local_instance_1.LocalInstanceService.setSSLCerts(name, type)), effect_1.Effect.all);
const type = cli_1.Options
    .choice('type', ['local-ip', 'self-signed', 'expired'])
    .pipe(cli_1.Options.withAlias('t'), cli_1.Options.withDescription('Type of SSL cert to set.'));
const names = cli_1.Args
    .text({ name: 'name' })
    .pipe(cli_1.Args.withDescription('The project name of the CHT instance to set the SSL certs on'), cli_1.Args.atLeast(1));
exports.setSSL = cli_1.Command
    .make('set-ssl', { names, type }, ({ names, type }) => setSSLCertOnInstances(names, type))
    .pipe(cli_1.Command.withDescription(`LOCAL ONLY: Set the SSL certs on a local CHT instance. Requires Docker and Docker Compose.`));
//# sourceMappingURL=set-ssl.js.map