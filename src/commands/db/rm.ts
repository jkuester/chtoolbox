import { Args, Command, Options, Prompt } from '@effect/cli';
import { Array, Console, Effect, Match, Option, pipe } from 'effect';
import { initializeUrl } from '../../index';
import { PouchDBService } from '../../services/pouchdb';

const destroyDbs = (dbs: string[]) => pipe(
  dbs,
  Array.map(PouchDBService.get),
  Array.map(Effect.flatMap(db => Effect.promise(() => db.destroy()))),
  Effect.all,
  Effect.tap(Console.log('Database(s) removed')),
);

const getConfirmationPrompt = (dbNames: string[]) => Prompt.confirm({
  message: `Are you sure you want to permanently remove ${Array.join(dbNames, ', ')}?`,
  initial: false,
});

const isRemoveConfirmed = (dbNames: string[], yes: boolean) => Match
  .value(yes)
  .pipe(
    Match.when(true, () => Effect.succeed(true)),
    Match.orElse(() => getConfirmationPrompt(dbNames)),
  );

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
    Options.withDefault(false),
  );

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The name of the database to remove'),
    Args.atLeast(1),
  );

export const rm = Command
  .make('rm', { databases, yes }, ({ databases, yes }) => initializeUrl.pipe(
    Effect.andThen(isRemoveConfirmed(databases, yes)),
    Effect.map(removeConfirmed => Option.liftPredicate(destroyDbs(databases), () => removeConfirmed)),
    Effect.flatMap(Option.getOrElse(() => Console.log('Operation cancelled'))),
  ))
  .pipe(Command.withDescription(`Remove Couch database. Nothing happens if the database does not exist.`));
