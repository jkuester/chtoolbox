"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instance = void 0;
const cli_1 = require("@effect/cli");
const create_1 = require("./create");
const rm_1 = require("./rm");
const stop_1 = require("./stop");
const start_1 = require("./start");
const set_ssl_1 = require("./set-ssl");
const ls_1 = require("./ls");
exports.instance = cli_1.Command
    .make('instance', {})
    .pipe(cli_1.Command.withDescription(`Manage CHT instances.`), cli_1.Command.withSubcommands([create_1.create, ls_1.ls, set_ssl_1.setSSL, start_1.start, stop_1.stop, rm_1.rm]));
//# sourceMappingURL=index.js.map