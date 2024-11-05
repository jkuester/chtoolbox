"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspect = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const dbs_info_1 = require("../../services/couch/dbs-info");
const core_1 = require("../../libs/core");
const databases = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database to inspect'), cli_1.Args.atLeast(1));
exports.inspect = cli_1.Command
    .make('inspect', { databases }, ({ databases }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(dbs_info_1.CouchDbsInfoService.post(databases)), effect_1.Effect.tap(core_1.logJson)))
    .pipe(cli_1.Command.withDescription(`Display detailed information on one or more Couch databases`));
//# sourceMappingURL=inspect.js.map