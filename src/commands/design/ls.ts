import { Args, Command } from '@effect/cli';
import { Array, Console, Effect, Option, pipe, Record } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDesignDocsService } from '../../services/couch/design-docs';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';

const getDesignDocNames = (dbName: string) => CouchDesignDocsService.pipe(
  Effect.flatMap(designDocsService => designDocsService.getNames(dbName)),
);

const printDesignDocNames = (dbName: string) => getDesignDocNames(dbName)
  .pipe(
    Effect.map(d => JSON.stringify(d, null, 2)),
    Effect.flatMap(Console.log)
  );

const getDisplayDict = (data: [readonly string[], string][]) => Array.reduce(
  data,
  {} as Record<string, readonly string[]>,
  (dict, [designNames, dbName]) => Record.set(dbName, designNames)(dict),
);

const printAllDesignDocNames = Effect
  .flatMap(CouchDbsInfoService, svc => svc.getDbNames())
  .pipe(
    Effect.flatMap(dbNames => pipe(
      Array.map(dbNames, getDesignDocNames),
      Effect.all,
      Effect.map(Array.zip(dbNames)),
      Effect.map(getDisplayDict),
    )),
    Effect.map(d => JSON.stringify(d, null, 2)),
    Effect.flatMap(Console.log),
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
