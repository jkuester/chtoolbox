import { Command } from '@effect/cli';
import { Array, Console, Effect } from 'effect';
import { initializeUrl } from "../../index.js";
import { CouchDbInfo, getAllDbsInfo } from "../../libs/couch/dbs-info.js";
import { getDisplayDictByPid } from "../../libs/couch/active-tasks.js";
const getDbDisplay = ({ info: { db_name, doc_count } }) => ({
    pid: db_name,
    doc_count,
});
export const ls = Command
    .make('ls', {}, () => initializeUrl.pipe(Effect.andThen(getAllDbsInfo()), Effect.map(Array.map(getDbDisplay)), Effect.map(getDisplayDictByPid), Effect.tap(Console.table)))
    .pipe(Command.withDescription(`List Couch databases`));
//# sourceMappingURL=ls.js.map