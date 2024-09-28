"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const cli_1 = require("@effect/cli");
const inspect_1 = require("./inspect");
exports.db = cli_1.Command
    .make('db', {})
    .pipe(cli_1.Command.withDescription(`Manage Couch databases.`), cli_1.Command.withSubcommands([inspect_1.inspect]));
//# sourceMappingURL=index.js.map