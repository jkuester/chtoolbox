import { Args, Command } from '@effect/cli';
import { Array, Effect, pipe, Record, Predicate } from 'effect';

import { logJson } from '../../libs/console.ts';
import { type ChtDdocDiff, type ChtDdocsDiffByDb, getDesignDocsDiff } from '../../libs/medic-staging.ts';
import type { CouchDesign } from '../../libs/couch/design.ts';

const getDesignIds = (designs: readonly CouchDesign[]) => pipe(
  designs,
  Array.map(({ _id }) => _id)
);
const getDisplayDiff = (diff: ChtDdocDiff) => pipe(
  diff,
  Record.mapEntries((designs, key) => [key, getDesignIds(designs)]),
  Record.filter(Array.isNonEmptyArray)
);
const printDdocDiff = (diffsByDb: ChtDdocsDiffByDb) => pipe(
  diffsByDb,
  Record.mapEntries((diff, key) => [key, getDisplayDiff(diff)]),
  Record.filter(Predicate.not(Record.isEmptyRecord)),
  logJson
);

const version = Args
  .text({ name: 'version' })
  .pipe(
    Args.withDescription('The CHT version to compare with'),
  );

export const diff = Command
  .make('diff', { version }, Effect.fn(({ version }) => pipe(
    getDesignDocsDiff(version),
    Effect.flatMap(printDdocDiff),
  )))
  .pipe(Command.withDescription(`Compare the current design documents with those from a specified CHT version.`));
