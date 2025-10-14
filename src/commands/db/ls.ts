import { Command } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { allDbsInfoEffect, CouchDbInfo } from '../../libs/couch/dbs-info.ts';
import { getDisplayDictByPid } from '../../libs/couch/active-tasks.ts';

const getDbDisplay = ({ info: { db_name, doc_count } }: CouchDbInfo) => ({
  pid: db_name,
  doc_count,
});

export const ls = Command
  .make('ls', {}, Effect.fn(() => pipe(
    allDbsInfoEffect,
    Effect.map(Array.map(getDbDisplay)),
    Effect.map(getDisplayDictByPid),
    Effect.tap(Console.table),
  )))
  .pipe(Command.withDescription(`List Couch databases`));
