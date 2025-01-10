import { Command } from '@effect/cli';
import { Array, Console, Effect } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDbInfo, getAllDbsInfo } from '../../services/couch/dbs-info';
import { getDisplayDictByPid } from '../../services/couch/active-tasks';

const getDbDisplay = ({ info: { db_name, doc_count } }: CouchDbInfo) => ({
  pid: db_name,
  doc_count,
});

export const ls = Command
  .make('ls', {}, () => initializeUrl.pipe(
    Effect.andThen(getAllDbsInfo()),
    Effect.map(Array.map(getDbDisplay)),
    Effect.map(getDisplayDictByPid),
    Effect.tap(Console.table),
  ))
  .pipe(Command.withDescription(`List Couch databases`));
