"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doc = void 0;
const cli_1 = require("@effect/cli");
const generate_1 = require("./generate");
const purge_1 = require("./purge");
const replicate_1 = require("./replicate");
exports.doc = cli_1.Command
    .make('doc', {})
    .pipe(cli_1.Command.withDescription(`Manage Couch documents.`), cli_1.Command.withSubcommands([generate_1.generate, purge_1.purge, replicate_1.replicate]));
//# sourceMappingURL=index.js.map