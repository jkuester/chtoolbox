"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.design = void 0;
const cli_1 = require("@effect/cli");
const inspect_1 = require("./inspect");
const compact_1 = require("./compact");
const ls_1 = require("./ls");
exports.design = cli_1.Command
    .make('design', {})
    .pipe(cli_1.Command.withDescription(`Manage Couch database designs.`), cli_1.Command.withSubcommands([compact_1.compact, inspect_1.inspect, ls_1.ls]));
//# sourceMappingURL=index.js.map