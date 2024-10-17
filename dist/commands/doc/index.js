"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doc = void 0;
const cli_1 = require("@effect/cli");
const purge_1 = require("./purge");
exports.doc = cli_1.Command
    .make('doc', {})
    .pipe(cli_1.Command.withDescription(`Manage Couch documents.`), cli_1.Command.withSubcommands([purge_1.purge]));
//# sourceMappingURL=index.js.map