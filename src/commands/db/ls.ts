import { Command } from '@effect/cli';
import { Array, Console, Effect } from 'effect';
import { initializeUrl } from '../../index.ts';
import { allDbsInfoEffect, CouchDbInfo } from '../../libs/couch/dbs-info.ts';
import { getDisplayDictByPid } from '../../libs/couch/active-tasks.ts';

const getDbDisplay = ({ info: { db_name, doc_count } }: CouchDbInfo) => ({
  pid: db_name,
  doc_count,
});

export const ls = Command
  .make('ls', {}, Effect.fn(() => initializeUrl.pipe(
    Effect.andThen(allDbsInfoEffect),
    Effect.map(Array.map(getDbDisplay)),
    Effect.map(getDisplayDictByPid),
    Effect.tap(Console.table),
  )))
  .pipe(Command.withDescription(`List Couch databases`));
