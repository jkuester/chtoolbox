"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ls = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const dbs_info_1 = require("../../services/couch/dbs-info");
const active_tasks_1 = require("../../services/couch/active-tasks");
const getDbDisplay = ({ info: { db_name, doc_count } }) => ({
    pid: db_name,
    doc_count,
});
exports.ls = cli_1.Command
    .make('ls', {}, () => index_1.initializeUrl.pipe(effect_1.Effect.andThen(dbs_info_1.CouchDbsInfoService.get()), effect_1.Effect.map(effect_1.Array.map(getDbDisplay)), effect_1.Effect.map(active_tasks_1.getDisplayDictByPid), effect_1.Effect.tap(effect_1.Console.table)))
    .pipe(cli_1.Command.withDescription(`List Couch databases`));
//# sourceMappingURL=ls.js.map