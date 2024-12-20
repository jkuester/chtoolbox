"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const cli_1 = require("@effect/cli");
const inspect_1 = require("./inspect");
const create_1 = require("./create");
const rm_1 = require("./rm");
const compact_1 = require("./compact");
const ls_1 = require("./ls");
exports.db = cli_1.Command
    .make('db', {})
    .pipe(cli_1.Command.withDescription(`Manage Couch databases.`), cli_1.Command.withSubcommands([create_1.create, compact_1.compact, inspect_1.inspect, ls_1.ls, rm_1.rm]));
//# sourceMappingURL=index.js.map