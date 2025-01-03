import { Args, Command } from '@effect/cli';
import { Array, Effect, Option, pipe, Record } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDesignDocsService } from '../../services/couch/design-docs';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';

import { logJson } from '../../libs/console';

const printDesignDocNames = (dbName: string) => CouchDesignDocsService
  .getNames(dbName)
  .pipe(Effect.flatMap(logJson));

const getDisplayDict = (data: [readonly string[], string][]) => Array.reduce(
  data,
  {} as Record<string, readonly string[]>,
  (dict, [designNames, dbName]) => Record.set(dbName, designNames)(dict),
);

const printAllDesignDocNames = CouchDbsInfoService
  .getDbNames()
  .pipe(
    Effect.flatMap(dbNames => pipe(
      Array.map(dbNames, CouchDesignDocsService.getNames),
      Effect.all,
      Effect.map(Array.zip(dbNames)),
      Effect.map(getDisplayDict),
    )),
    Effect.flatMap(logJson),
  );

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database with the designs to list'),
    Args.optional
  );

export const ls = Command
  .make('ls', { database }, ({ database }) => initializeUrl.pipe(
    Effect.andThen(Effect.succeed(database)),
    Effect.map(Option.map(printDesignDocNames)),
    Effect.flatMap(Option.getOrElse(() => printAllDesignDocNames)),
  ))
  .pipe(Command.withDescription(`List designs for a Couch database`));
